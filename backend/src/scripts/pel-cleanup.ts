/**
 * Telemetry consumer-group PEL maintenance.
 *
 * The telemetry consumer reads the stream with `XREADGROUP ... '>'`, so a
 * message that is delivered but never acknowledged stays in the group's
 * pending entries list (PEL) forever — it is never re-delivered and nothing
 * ever retries it. Two kinds of entries pile up there:
 *
 *   1. Messages the consumer deliberately skipped (invalid GPS fix, unknown
 *      IMEI, missing fields). Pure noise, nothing was lost.
 *   2. Messages that were delivered but whose batch write never completed
 *      (backend restart / crash mid-batch). These are real, recoverable
 *      readings — but only while they are still inside the stream, because
 *      `XTRIM MAXLEN` drops the oldest entries.
 *
 * This tool walks the PEL and, for every entry that is still present in the
 * stream, replays it through the same validation + insert path the consumer
 * uses. Everything is then acknowledged, which also clears the entries that
 * were already trimmed out of the stream (Redis >= 7 removes those
 * automatically during XAUTOCLAIM).
 *
 * Usage (inside the backend container):
 *
 *   node dist/scripts/pel-cleanup.js              # dry run, read-only report
 *   node dist/scripts/pel-cleanup.js --apply      # replay + acknowledge
 *
 * Optional environment:
 *   PEL_MIN_IDLE_MS   only touch entries idle for at least this long
 *                     (default 300000 = 5 min, protects in-flight batches)
 *   PEL_BATCH         XAUTOCLAIM page size (default 500)
 */
import Redis from 'ioredis';
import { Pool } from 'pg';

const STREAM_KEY = 'gps:telemetry:stream';
const GROUP_NAME = 'nestjs-telemetry-group';
const CLEANUP_CONSUMER = 'pel-cleanup';

const APPLY = process.argv.includes('--apply');
const MIN_IDLE_MS = Number(process.env.PEL_MIN_IDLE_MS ?? 300_000);
const BATCH = Number(process.env.PEL_BATCH ?? 500);

interface TelemetryPayload {
  imei?: string;
  timestamp?: number;
  fix_valid?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  speed_kph?: number | null;
  course?: number | null;
  source?: string;
  ip?: string;
  packet_type?: string;
  date_ddmmyy?: string;
  time_hhmmss?: string;
  ignition?: string;
  main_power?: string;
  immobilizer?: string;
  sleep?: string;
  movement?: string;
  odometer_km?: number | null;
  temperature_c?: number | null;
  battery_v?: number | null;
  gsm_signal?: number | null;
  mcc?: string;
  mnc?: string;
  lac?: string;
  cell_id?: string;
  raw?: string;
}

type SkipReason =
  | 'malformed'
  | 'missing_fields'
  | 'invalid_fix'
  | 'unknown_imei'
  | 'no_timestamp';

interface ReadingRow {
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  timestamp: Date;
  source: string | null;
  ip: string | null;
  packetType: string | null;
  gpsDate: string | null;
  gpsTime: string | null;
  ignition: string | null;
  mainPower: string | null;
  immobilizer: string | null;
  sleep: string | null;
  movement: string | null;
  odometerKm: number | null;
  temperatureC: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  mcc: string | null;
  mnc: string | null;
  lac: string | null;
  cellId: string | null;
  raw: string | null;
}

const INSERT_SQL = `
  INSERT INTO gps_readings (
    "deviceId", latitude, longitude, speed, heading, "timestamp",
    source, ip, "packetType", "gpsDate", "gpsTime",
    ignition, "mainPower", immobilizer, sleep, movement,
    "odometerKm", "temperatureC", "batteryV", "gsmSignal",
    mcc, mnc, lac, "cellId", raw
  )
  SELECT
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16,
    $17, $18, $19, $20,
    $21, $22, $23, $24, $25
  WHERE NOT EXISTS (
    SELECT 1 FROM gps_readings
    WHERE "deviceId" = $1 AND "timestamp" = $6
  )
`;

const stats = {
  pelBefore: 0,
  trimmed: 0,
  alive: 0,
  skipped: {} as Record<SkipReason, number>,
  replayable: 0,
  inserted: 0,
  alreadyPresent: 0,
  acked: 0,
  deletedByRedis: 0,
};

function bump(reason: SkipReason) {
  stats.skipped[reason] = (stats.skipped[reason] ?? 0) + 1;
}

function extractPayload(fields: string[]): string | null {
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === 'payload') return fields[i + 1];
  }
  return null;
}

function idToNumber(id: string): number {
  const [ms, seq] = id.split('-');
  return Number(ms) * 1_000_000 + Number(seq);
}

class PelCleanup {
  private readonly devices = new Map<string, string | null>();

  constructor(
    private readonly redis: Redis,
    private readonly pool: Pool,
  ) {}

  private async deviceIdFor(imei: string): Promise<string | null> {
    const cached = this.devices.get(imei);
    if (cached !== undefined) return cached;
    const { rows } = await this.pool.query<{ id: string }>(
      'SELECT id FROM gps_devices WHERE imei = $1 LIMIT 1',
      [imei],
    );
    const id = rows[0]?.id ?? null;
    this.devices.set(imei, id);
    return id;
  }

  /** Turn a raw stream payload into an insertable row, or explain why not. */
  private async classify(
    payload: string | null,
  ): Promise<{ row: ReadingRow } | { skip: SkipReason }> {
    if (!payload) return { skip: 'malformed' };

    let data: TelemetryPayload;
    try {
      data = JSON.parse(payload) as TelemetryPayload;
    } catch {
      return { skip: 'malformed' };
    }

    if (
      !data.imei ||
      data.latitude === null ||
      data.latitude === undefined ||
      data.longitude === null ||
      data.longitude === undefined
    ) {
      return { skip: 'missing_fields' };
    }

    if (data.fix_valid === false) return { skip: 'invalid_fix' };

    const deviceId = await this.deviceIdFor(String(data.imei));
    if (!deviceId) return { skip: 'unknown_imei' };

    if (typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp)) {
      return { skip: 'no_timestamp' };
    }

    return {
      row: {
        deviceId,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        speed: data.speed_kph ?? null,
        heading: data.course == null ? null : Math.round(Number(data.course)),
        timestamp: new Date(data.timestamp),
        source: data.source ?? null,
        ip: data.ip ?? null,
        packetType: data.packet_type ?? null,
        gpsDate: data.date_ddmmyy ?? null,
        gpsTime: data.time_hhmmss ?? null,
        ignition: data.ignition ?? null,
        mainPower: data.main_power ?? null,
        immobilizer: data.immobilizer ?? null,
        sleep: data.sleep ?? null,
        movement: data.movement ?? null,
        odometerKm: data.odometer_km ?? null,
        temperatureC: data.temperature_c ?? null,
        batteryV: data.battery_v ?? null,
        gsmSignal: data.gsm_signal ?? null,
        mcc: data.mcc ?? null,
        mnc: data.mnc ?? null,
        lac: data.lac ?? null,
        cellId: data.cell_id ?? null,
        raw: data.raw ?? null,
      },
    };
  }

  private async insert(row: ReadingRow): Promise<boolean> {
    const { rowCount } = await this.pool.query(INSERT_SQL, [
      row.deviceId,
      row.latitude,
      row.longitude,
      row.speed,
      row.heading,
      row.timestamp,
      row.source,
      row.ip,
      row.packetType,
      row.gpsDate,
      row.gpsTime,
      row.ignition,
      row.mainPower,
      row.immobilizer,
      row.sleep,
      row.movement,
      row.odometerKm,
      row.temperatureC,
      row.batteryV,
      row.gsmSignal,
      row.mcc,
      row.mnc,
      row.lac,
      row.cellId,
      row.raw,
    ]);
    return (rowCount ?? 0) > 0;
  }

  private async handle(id: string, fields: string[]) {
    const verdict = await this.classify(extractPayload(fields));
    if ('skip' in verdict) {
      bump(verdict.skip);
      return;
    }
    stats.replayable += 1;
    if (!APPLY) return;
    if (await this.insert(verdict.row)) stats.inserted += 1;
    else stats.alreadyPresent += 1;
  }

  async run(): Promise<void> {
    const summary = (await this.redis.call(
      'XPENDING',
      STREAM_KEY,
      GROUP_NAME,
    )) as [number, string, string, unknown];
    stats.pelBefore = Number(summary[0]);

    const firstEntry = (await this.redis.call(
      'XRANGE',
      STREAM_KEY,
      '-',
      '+',
      'COUNT',
      1,
    )) as [string, string[]][];
    const firstId = firstEntry[0]?.[0] ?? '0-0';
    const firstNum = idToNumber(firstId);

    if (!APPLY) {
      await this.dryRun(firstNum);
    } else {
      await this.drain();
    }
  }

  /** Read-only walk: classify every pending id without touching the PEL. */
  private async dryRun(firstNum: number) {
    let cursor = '-';
    for (;;) {
      const page = (await this.redis.call(
        'XPENDING',
        STREAM_KEY,
        GROUP_NAME,
        cursor,
        '+',
        1000,
      )) as [string, string, string, string][];
      if (page.length === 0) break;

      const alive = page.filter(([id]) => idToNumber(id) >= firstNum);
      stats.trimmed += page.length - alive.length;
      stats.alive += alive.length;

      if (alive.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const [id] of alive) pipeline.call('XRANGE', STREAM_KEY, id, id);
        const results = await pipeline.exec();
        for (let i = 0; i < alive.length; i += 1) {
          const entry = (results?.[i]?.[1] as [string, string[]][]) ?? [];
          if (entry.length === 0) {
            stats.alive -= 1;
            stats.trimmed += 1;
            continue;
          }
          await this.handle(entry[0][0], entry[0][1]);
        }
      }

      cursor = `(${page[page.length - 1][0]}`;
    }
  }

  /** Replay survivors and acknowledge everything (Redis prunes trimmed ids). */
  private async drain() {
    let cursor = '0-0';
    do {
      const [nextCursor, messages, deleted] = (await this.redis.call(
        'XAUTOCLAIM',
        STREAM_KEY,
        GROUP_NAME,
        CLEANUP_CONSUMER,
        MIN_IDLE_MS,
        cursor,
        'COUNT',
        BATCH,
      )) as [string, [string, string[]][], string[]];

      cursor = nextCursor;
      stats.deletedByRedis += deleted?.length ?? 0;

      const ackIds: string[] = [];
      for (const [id, fields] of messages ?? []) {
        await this.handle(id, fields);
        ackIds.push(id);
      }

      if (ackIds.length > 0) {
        await this.redis.call('XACK', STREAM_KEY, GROUP_NAME, ...ackIds);
        stats.acked += ackIds.length;
      }
    } while (cursor !== '0-0');
  }
}

function report() {
  const line = (label: string, value: number | string) =>
    console.log(`  ${label.padEnd(34)} ${value}`);

  console.log('');
  console.log(APPLY ? 'PEL cleanup — APPLIED' : 'PEL cleanup — DRY RUN (nothing changed)');
  line('pending before', stats.pelBefore);
  if (APPLY) {
    line('acknowledged', stats.acked);
    line('pruned by Redis (trimmed)', stats.deletedByRedis);
    line('inserted', stats.inserted);
    line('already present (duplicate)', stats.alreadyPresent);
  } else {
    line('already trimmed from stream', stats.trimmed);
    line('still in stream', stats.alive);
  }
  line('replayable readings', stats.replayable);
  for (const [reason, count] of Object.entries(stats.skipped)) {
    line(`skipped: ${reason}`, count);
  }
  console.log('');
}

async function main() {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER ?? process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? undefined,
        database: process.env.DB_NAME ?? 'nexus_fleet',
      });

  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? undefined,
    maxRetriesPerRequest: 3,
  });

  try {
    await new PelCleanup(redis, pool).run();
    report();

    if (APPLY) {
      const after = (await redis.call(
        'XPENDING',
        STREAM_KEY,
        GROUP_NAME,
      )) as [number, string, string, unknown];
      console.log(`  pending after                      ${Number(after[0])}\n`);
    }
  } finally {
    await redis.quit();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('PEL cleanup failed:', err);
  process.exitCode = 1;
});
