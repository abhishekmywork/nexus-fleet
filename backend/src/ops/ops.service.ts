import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

const STREAM_KEY = 'gps:telemetry:stream';
const GROUP_NAME = 'nestjs-telemetry-group';

/** Device is "online" if it reported within this window. */
const ONLINE_MS = 10 * 60 * 1000;
/** Beyond this it is considered offline rather than merely stale. */
const STALE_MS = 2 * 60 * 60 * 1000;

type IngestStatus = 'healthy' | 'degraded' | 'critical';
type DeviceStatus = 'online' | 'stale' | 'offline' | 'never';

interface CacheEntry {
  expires: number;
  value: unknown;
}

/** Turn a flat Redis key/value reply (XINFO) into an object. */
function flatToObject(flat: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out[String(flat[i])] = flat[i + 1];
  }
  return out;
}

/** Redis stream ids are `<milliseconds>-<sequence>`. */
function streamIdToMs(id: string): number {
  return Number(String(id).split('-')[0]);
}

@Injectable()
export class OpsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpsService.name);
  private redis: Redis;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
  ) {}

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    });
    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error (ops)', err);
    });
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }

  private async cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const value = await load();
    this.cache.set(key, { expires: Date.now() + ttlMs, value });
    return value;
  }

  /**
   * Redis call that tolerates a missing stream or consumer group (fresh Redis,
   * flushed instance, first boot). Returns the fallback instead of throwing so
   * the panel reports "critical" rather than failing with a 500.
   */
  private async safeCall<T>(fallback: T, ...args: (string | number)[]): Promise<T> {
    try {
      const [command, ...rest] = args;
      return (await this.redis.call(String(command), ...rest)) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/NOGROUP|no such key/i.test(message)) {
        this.logger.warn(`Redis call failed: ${args.join(' ')} — ${message}`);
      }
      return fallback;
    }
  }

  /**
   * Tenant scoping predicate. `offset` is the 1-based position of the tenant
   * parameter in the query, so callers that already used $1 for something else
   * (a timestamp) can keep numbering straight.
   */
  private tenantCond(
    user: AuthenticatedUser,
    alias: string,
    offset = 1,
  ): { sql: string; params: string[] } {
    if (user.isSuperUser || !user.tenantId) return { sql: '1=1', params: [] };
    return { sql: `${alias}."tenantId" = $${offset}`, params: [user.tenantId] };
  }

  // ---------------------------------------------------------------- ingest

  /**
   * Live view of the ingest pipeline: how much is queued in the stream, how far
   * the consumer group has read, what is stuck in the PEL, and how fresh the
   * newest packet is. Everything here is O(1) in Redis.
   */
  async getIngest() {
    return this.cached('ingest', 5_000, async () => {
      const [length, first, last, groupsRaw, consumersRaw, pendingRaw] =
        await Promise.all([
          this.safeCall(0, 'XLEN', STREAM_KEY),
          this.safeCall<unknown[]>([], 'XRANGE', STREAM_KEY, '-', '+', 'COUNT', 1),
          this.safeCall<unknown[]>([], 'XREVRANGE', STREAM_KEY, '+', '-', 'COUNT', 1),
          this.safeCall<unknown[]>([], 'XINFO', 'GROUPS', STREAM_KEY),
          this.safeCall<unknown[]>([], 'XINFO', 'CONSUMERS', STREAM_KEY, GROUP_NAME),
          this.safeCall<unknown[]>([], 'XPENDING', STREAM_KEY, GROUP_NAME),
        ]);

      const group = ((groupsRaw as unknown[][]) ?? [])
        .map(flatToObject)
        .find((g) => g.name === GROUP_NAME);

      const consumers = ((consumersRaw as unknown[][]) ?? []).map((raw) => {
        const c = flatToObject(raw);
        return {
          name: String(c.name),
          pending: Number(c.pending ?? 0),
          idleMs: Number(c.idle ?? 0),
          inactiveMs: Number(c.inactive ?? 0),
        };
      });

      const pending = Number((pendingRaw as unknown[])?.[0] ?? 0);
      const lastId = ((last as [string, string[]][])?.[0]?.[0]) ?? null;
      const firstId = ((first as [string, string[]][])?.[0]?.[0]) ?? null;
      const lastEntryAgeMs = lastId ? Date.now() - streamIdToMs(lastId) : null;
      const lag = group ? Number(group.lag ?? 0) : null;

      let status: IngestStatus = 'healthy';
      if (
        lastEntryAgeMs === null ||
        lastEntryAgeMs > 300_000 ||
        pending > 5_000 ||
        (lag ?? 0) > 5_000 ||
        consumers.length === 0
      ) {
        status = 'critical';
      } else if (
        lastEntryAgeMs > 120_000 ||
        pending > 500 ||
        (lag ?? 0) > 500
      ) {
        status = 'degraded';
      }

      const discards = await this.getDiscards();

      return {
        generatedAt: new Date().toISOString(),
        status,
        stream: { length, firstId, lastId, lastEntryAgeMs },
        group: {
          name: GROUP_NAME,
          consumers: consumers.length,
          pending,
          lag,
          lastDeliveredId: group ? String(group['last-delivered-id'] ?? '') : null,
        },
        consumers,
        discards,
      };
    });
  }

  /** Per-reason packet discard counters written by the telemetry consumer. */
  private async getDiscards() {
    const day = new Date().toISOString().slice(0, 10);
    const raw = (await this.redis.call('HGETALL', `ops:discards:${day}`)) as string[];
    const counts: Record<string, number> = {};
    for (let i = 0; i + 1 < (raw?.length ?? 0); i += 2) {
      counts[raw[i]] = Number(raw[i + 1]);
    }
    return {
      date: day,
      invalid_fix: counts.invalid_fix ?? 0,
      unknown_imei: counts.unknown_imei ?? 0,
      missing_fields: counts.missing_fields ?? 0,
      malformed: counts.malformed ?? 0,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  }

  // ---------------------------------------------------------------- volume

  /**
   * Readings per hour over the window. Aggregated per device so the
   * ("deviceId", "timestamp") index is used — there is deliberately no plain
   * timestamp index on gps_readings.
   */
  async getVolume(user: AuthenticatedUser, hours = 24) {
    const span = Math.min(Math.max(hours, 1), 168);
    const tenant = this.tenantCond(user, 'd', 2);
    return this.cached(`volume:${user.tenantId ?? 'all'}:${span}`, 60_000, async () => {
      const start = new Date(Date.now() - span * 60 * 60 * 1000);
      const params: unknown[] = [start, ...tenant.params];

      const rows = await this.readings.query(
        `SELECT h.hour AS "hour", SUM(h.cnt)::int AS "count"
         FROM gps_devices d
         CROSS JOIN LATERAL (
           SELECT date_trunc('hour', r."timestamp") AS hour, COUNT(*)::int AS cnt
           FROM gps_readings r
           WHERE r."deviceId" = d.id
             AND r."timestamp" >= $1
           GROUP BY 1
         ) h
         WHERE ${tenant.sql}
         GROUP BY h.hour
         ORDER BY h.hour`,
        params,
      );

      const series = rows.map((r: { hour: string; count: number }) => ({
        hour: new Date(r.hour).toISOString(),
        count: Number(r.count),
      }));

      return {
        windowHours: span,
        total: series.reduce((sum: number, p: { count: number }) => sum + p.count, 0),
        series,
      };
    });
  }

  // --------------------------------------------------------------- devices

  /**
   * Per-device data quality. Unlike the analytics device-health report this
   * LEFT JOINs vehicles, so a device with no vehicle (the usual way a tracker
   * goes missing) still shows up.
   */
  async getDevices(user: AuthenticatedUser) {
    const tenant = this.tenantCond(user, 'd', 2);
    return this.cached(`devices:${user.tenantId ?? 'all'}`, 30_000, async () => {
      const now = Date.now();
      const start = new Date(now - 24 * 60 * 60 * 1000);

      const rows = await this.devices.query(
        `SELECT
           d.id AS "deviceId",
           d.imei,
           d."serialNumber" AS "serialNumber",
           d."simNo" AS "simNo",
           v."plateNumber" AS "plateNumber",
           t.name AS "tenantName",
           l."lastSeen" AS "lastSeen",
           l."batteryV" AS "batteryV",
           l."gsmSignal" AS "gsmSignal",
           c."count24" AS "count24"
         FROM gps_devices d
         LEFT JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
         LEFT JOIN tenants t ON t.id = d."tenantId"
         LEFT JOIN LATERAL (
           SELECT r."timestamp" AS "lastSeen", r."batteryV", r."gsmSignal"
           FROM gps_readings r
           WHERE r."deviceId" = d.id
           ORDER BY r."timestamp" DESC
           LIMIT 1
         ) l ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS "count24"
           FROM gps_readings r
           WHERE r."deviceId" = d.id
             AND r."timestamp" >= $1
         ) c ON true
         WHERE ${tenant.sql}
         ORDER BY l."lastSeen" DESC NULLS LAST`,
        [start, ...tenant.params],
      );

      const devices = rows.map((r: Record<string, unknown>) => {
        const lastSeen = r.lastSeen ? new Date(r.lastSeen as string) : null;
        const ageMs = lastSeen ? now - lastSeen.getTime() : null;
        let status: DeviceStatus = 'never';
        if (ageMs !== null) {
          if (ageMs <= ONLINE_MS) status = 'online';
          else if (ageMs <= STALE_MS) status = 'stale';
          else status = 'offline';
        }
        return {
          deviceId: String(r.deviceId),
          imei: String(r.imei),
          serialNumber: (r.serialNumber as string) ?? null,
          simNo: (r.simNo as string) ?? null,
          plateNumber: (r.plateNumber as string) ?? null,
          tenantName: (r.tenantName as string) ?? null,
          lastSeen: lastSeen ? lastSeen.toISOString() : null,
          ageMs,
          readings24h: Number(r.count24 ?? 0),
          batteryV: r.batteryV != null ? Number(r.batteryV) : null,
          gsmSignal: r.gsmSignal != null ? Number(r.gsmSignal) : null,
          status,
        };
      });

      const summary = {
        total: devices.length,
        online: devices.filter((d: { status: string }) => d.status === 'online').length,
        stale: devices.filter((d: { status: string }) => d.status === 'stale').length,
        offline: devices.filter((d: { status: string }) => d.status === 'offline').length,
        never: devices.filter((d: { status: string }) => d.status === 'never').length,
        unlinked: devices.filter((d: { plateNumber: string | null }) => !d.plateNumber).length,
      };

      return { generatedAt: new Date(now).toISOString(), summary, devices };
    });
  }

  // --------------------------------------------------------------- orphans

  /**
   * IMEIs that are sending packets but have no row in gps_devices. Counters are
   * written by the telemetry consumer, so this is a couple of hash reads.
   */
  async getOrphans() {
    const [counts, last, first] = await Promise.all([
      this.redis.call('HGETALL', 'ops:unknown_imei_count') as Promise<string[]>,
      this.redis.call('HGETALL', 'ops:unknown_imei_last') as Promise<string[]>,
      this.redis.call('HGETALL', 'ops:unknown_imei_first') as Promise<string[]>,
    ]);

    const toMap = (flat: string[]): Record<string, string> => {
      const out: Record<string, string> = {};
      for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) out[flat[i]] = flat[i + 1];
      return out;
    };

    const countMap = toMap(counts);
    const lastMap = toMap(last);
    const firstMap = toMap(first);

    const orphans = Object.keys(countMap).map((imei) => {
      let pos: { lastSeen?: number; latitude?: number | null; longitude?: number | null } = {};
      try {
        pos = JSON.parse(lastMap[imei] ?? '{}');
      } catch {
        pos = {};
      }
      return {
        imei,
        packets: Number(countMap[imei] ?? 0),
        firstSeen: firstMap[imei] ? new Date(Number(firstMap[imei])).toISOString() : null,
        lastSeen: pos.lastSeen ? new Date(pos.lastSeen).toISOString() : null,
        latitude: pos.latitude ?? null,
        longitude: pos.longitude ?? null,
      };
    });

    orphans.sort((a, b) => b.packets - a.packets);
    return { generatedAt: new Date().toISOString(), count: orphans.length, orphans };
  }

  // ------------------------------------------------------------- integrity

  /** Duplicate readings and the GPS-cleaner backlog over the last 24 hours. */
  async getIntegrity(user: AuthenticatedUser) {
    const tenant = this.tenantCond(user, 'd', 2);
    return this.cached(`integrity:${user.tenantId ?? 'all'}`, 300_000, async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [totals, duplicates, unprocessed] = await Promise.all([
        this.readings.query(
          `SELECT COUNT(*)::int AS "total"
           FROM gps_devices d
           CROSS JOIN LATERAL (
             SELECT 1 FROM gps_readings r
             WHERE r."deviceId" = d.id AND r."timestamp" >= $1
           ) r
           WHERE ${tenant.sql}`,
          [start, ...tenant.params],
        ),
        this.readings.query(
          `SELECT COUNT(*)::int AS "duplicates" FROM (
             SELECT r."deviceId", r."timestamp"
             FROM gps_devices d
             CROSS JOIN LATERAL (
               SELECT r."deviceId", r."timestamp" FROM gps_readings r
               WHERE r."deviceId" = d.id AND r."timestamp" >= $1
             ) r
             WHERE ${tenant.sql}
             GROUP BY 1, 2
             HAVING COUNT(*) > 1
           ) dup`,
          [start, ...tenant.params],
        ),
        this.readings.query(
          `SELECT COUNT(*)::int AS "unprocessed" FROM gps_readings WHERE processed = false`,
        ),
      ]);

      return {
        windowHours: 24,
        totalReadings: Number(totals[0]?.total ?? 0),
        duplicates: Number(duplicates[0]?.duplicates ?? 0),
        unprocessedBacklog: Number(unprocessed[0]?.unprocessed ?? 0),
      };
    });
  }
}
