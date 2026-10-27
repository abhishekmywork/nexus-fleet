import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { EventDetectorService } from '../events/event-detector.service';
import { DeviceStateService } from '../events/device-state.service';
import { LiveMapGateway, PositionPayload } from '../live-map/live-map.gateway';
import { GpsCleanerService } from './gps-cleaner.service';

interface TelemetryPayload {
  source?: string;
  ip?: string;
  timestamp?: number;
  packet_type?: string;
  imei: string;
  fix_valid?: boolean;
  latitude: number;
  longitude: number;
  speed_kph?: number;
  course?: number;
  date_ddmmyy?: string;
  time_hhmmss?: string;
  ignition?: string;
  main_power?: string;
  immobilizer?: string;
  sleep?: string;
  movement?: string;
  odometer_km?: number;
  temperature_c?: number;
  battery_v?: number;
  gsm_signal?: number;
  mcc?: string;
  mnc?: string;
  lac?: string;
  cell_id?: string;
  raw?: string;
}

@Injectable()
export class TelemetryConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TelemetryConsumerService.name);
  private redisClient: Redis;
  private isRunning = false;

  private readonly STREAM_KEY = 'gps:telemetry:stream';
  private readonly GROUP_NAME = 'nestjs-telemetry-group';
  private readonly CONSUMER_NAME = `consumer-${process.pid}`;

  constructor(
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    private readonly eventDetector: EventDetectorService,
    private readonly stateService: DeviceStateService,
    private readonly liveMapGateway: LiveMapGateway,
    private readonly gpsCleaner: GpsCleanerService,
  ) {}

  async onApplicationBootstrap() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });

    // Share Redis client with state service
    this.stateService.setRedisClient(this.redisClient);

    await this.initConsumerGroup();
    this.isRunning = true;
    this.pollStream();
    this.logger.log('Telemetry consumer started');
  }

  async onApplicationShutdown() {
    this.isRunning = false;
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.redisClient) return false;
      const result = await this.redisClient.call('PING');
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  private async initConsumerGroup() {
    try {
      await this.redisClient.xgroup(
        'CREATE',
        this.STREAM_KEY,
        this.GROUP_NAME,
        '0',
        'MKSTREAM',
      );
      this.logger.log(`Created Redis Consumer Group: ${this.GROUP_NAME}`);
    } catch (err: any) {
      if (err.message?.includes('BUSYGROUP')) {
        this.logger.log(
          `Consumer Group ${this.GROUP_NAME} already exists.`,
        );
      } else {
        this.logger.error(
          'Failed to initialize Redis Consumer Group',
          err,
        );
      }
    }
  }

  private async pollStream() {
    while (this.isRunning) {
      try {
        const response = (await this.redisClient.call(
          'XREADGROUP',
          'GROUP',
          this.GROUP_NAME,
          this.CONSUMER_NAME,
          'BLOCK',
          '2000',
          'COUNT',
          '100',
          'STREAMS',
          this.STREAM_KEY,
          '>',
        )) as [string, [string, string[]][]][] | null;

        if (response && response.length > 0) {
          const [, messages] = response[0];
          await this.processBatch(messages);
        }
      } catch (err) {
        this.logger.error('Error polling Redis Stream', err);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async processBatch(
    messages: [string, string[]][],
  ) {
    const idsToAck: string[] = [];
    const readings: Partial<GPSReading>[] = [];
    const discards: Record<string, number> = {};
    const unknownImeis = new Map<
      string,
      { count: number; latitude: number | null; longitude: number | null }
    >();
    const countDiscard = (reason: string) => {
      discards[reason] = (discards[reason] ?? 0) + 1;
    };
    const detectionInputs: {
      deviceId: string;
      imei: string;
      tenantId: string;
      latitude?: number;
      longitude?: number;
      speed?: number;
      heading?: number | null;
      ignition?: string;
      movement?: string;
      batteryV?: number;
      timestamp?: string;
      raw?: string;
    }[] = [];

    // Cache device lookups to avoid repeated queries
    const deviceCache = new Map<string, { id: string; tenantId: string; vehicleId: string | null; plateNumber: string | null }>();

    for (const [messageId, fields] of messages) {
      try {
        const rawPayload = fields[1];
        let data: TelemetryPayload;
        try {
          data = JSON.parse(rawPayload);
        } catch {
          this.logger.warn(`Skipping message ${messageId}: malformed payload`);
          countDiscard('malformed');
          idsToAck.push(messageId);
          continue;
        }

        if (!data.imei || data.latitude == null || data.longitude == null) {
          this.logger.warn(
            `Skipping message ${messageId}: missing required fields`,
          );
          countDiscard('missing_fields');
          idsToAck.push(messageId);
          continue;
        }

        // Skip invalid GPS fixes
        if (data.fix_valid === false) {
          countDiscard('invalid_fix');
          idsToAck.push(messageId);
          continue;
        }

        // Look up device by IMEI
        let deviceInfo = deviceCache.get(data.imei);
        if (!deviceInfo) {
          const device = await this.devices.findOne({
            where: { imei: data.imei },
          });
          if (!device) {
            this.logger.warn(
              `Skipping message ${messageId}: no device found for IMEI ${data.imei}`,
            );
            countDiscard('unknown_imei');
            const known = unknownImeis.get(data.imei) ?? {
              count: 0,
              latitude: null,
              longitude: null,
            };
            known.count += 1;
            known.latitude = data.latitude ?? known.latitude;
            known.longitude = data.longitude ?? known.longitude;
            unknownImeis.set(data.imei, known);
            idsToAck.push(messageId);
            continue;
          }
          deviceInfo = { id: device.id, tenantId: device.tenantId, vehicleId: device.vehicleId, plateNumber: null };
          // Fetch plate number from vehicle if linked (use QueryBuilder to avoid eager servingAreas join)
          if (device.vehicleId) {
            const result = await this.devices.manager
              .createQueryBuilder('Vehicle', 'v')
              .select('v.plateNumber', 'plateNumber')
              .where('v.id = :id', { id: device.vehicleId })
              .getRawOne();
            if (result) deviceInfo.plateNumber = result.plateNumber;
          }
          deviceCache.set(data.imei, deviceInfo);
        }

        const ts = data.timestamp
          ? new Date(data.timestamp).toISOString()
          : new Date().toISOString();

        readings.push({
          deviceId: deviceInfo.id,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed_kph ?? null,
          heading: data.course ?? null,
          timestamp: new Date(ts),
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
        });

        detectionInputs.push({
          deviceId: deviceInfo.id,
          imei: data.imei,
          tenantId: deviceInfo.tenantId,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed_kph,
          heading: data.course ?? null,
          ignition: data.ignition,
          movement: data.movement,
          batteryV: data.battery_v,
          timestamp: ts,
          raw: data.raw,
        });

        idsToAck.push(messageId);
      } catch (e) {
        this.logger.error(
          `Failed to parse telemetry packet ${messageId}`,
          e,
        );
      }
    }

    if (readings.length === 0) {
      // Every message in the batch was deliberately skipped (invalid GPS fix,
      // unknown IMEI, missing fields). They still have to be acknowledged:
      // the consumer only reads new entries ('>'), so anything left in the
      // group PEL is never re-delivered and just accumulates forever.
      await this.recordDiscards(discards, unknownImeis);
      if (idsToAck.length > 0) {
        try {
          await this.redisClient.xack(
            this.STREAM_KEY,
            this.GROUP_NAME,
            ...idsToAck,
          );
        } catch (ackError) {
          this.logger.error(
            'Failed to acknowledge skipped telemetry batch',
            ackError,
          );
        }
      }
      return;
    }

    try {
      await this.readings
        .createQueryBuilder()
        .insert()
        .into(GPSReading)
        .values(readings)
        .execute();

      this.logger.log(
        `Batch-inserted ${readings.length} telemetry readings`,
      );

      // Trigger async GPS cleaning for inserted devices (fire-and-forget)
      const deviceIds = [...new Set(readings.map((r) => r.deviceId))];
      for (const devId of deviceIds) {
        this.gpsCleaner.processUnprocessed(devId).catch((err) => {
          this.logger.error(`GPS cleaning failed for device ${devId}`, err);
        });
      }

      // Run event detection on each reading (fire-and-forget, don't block ingestion)
      for (const input of detectionInputs) {
        this.eventDetector.detect(input).catch((err) => {
          this.logger.error(`Event detection failed for IMEI ${input.imei}`, err);
        });
      }

      // Broadcast positions to live map WebSocket clients
      for (let i = 0; i < detectionInputs.length; i++) {
        const input = detectionInputs[i];
        const device = deviceCache.get(input.imei);
        if (device) {
          const payload: PositionPayload = {
            deviceId: device.id,
            vehicleId: device.vehicleId,
            plateNumber: device.plateNumber,
            latitude: input.latitude ?? 0,
            longitude: input.longitude ?? 0,
            latitudeCleaned: null,
            longitudeCleaned: null,
            speed: input.speed ?? null,
            heading: input.heading ?? null,
            ignition: input.ignition ?? null,
            movement: input.movement ?? null,
            timestamp: input.timestamp ?? new Date().toISOString(),
          };
          this.liveMapGateway.broadcastPosition(device.tenantId, payload);
        }
      }

      await this.redisClient.xack(
        this.STREAM_KEY,
        this.GROUP_NAME,
        ...idsToAck,
      );
    } catch (dbError) {
      this.logger.error(
        'Database write failed during batch ingestion',
        dbError,
      );
    }

    await this.recordDiscards(discards, unknownImeis);
  }

  /**
   * Persist per-reason discard counters for the System Health page.
   *
   * Kept in Redis rather than Postgres: these are short-lived counters, they
   * are read by a live panel, and a write per batch must stay cheap.
   */
  private async recordDiscards(
    discards: Record<string, number>,
    unknownImeis: Map<
      string,
      { count: number; latitude: number | null; longitude: number | null }
    >,
  ) {
    const reasons = Object.entries(discards);
    if (reasons.length === 0 && unknownImeis.size === 0) return;

    const TTL = 30 * 24 * 60 * 60;
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);

    try {
      const pipe = this.redisClient.pipeline();
      if (reasons.length > 0) {
        for (const [reason, count] of reasons) {
          pipe.hincrby(`ops:discards:${day}`, reason, count);
        }
        pipe.expire(`ops:discards:${day}`, TTL);
      }
      for (const [imei, info] of unknownImeis) {
        pipe.hincrby('ops:unknown_imei_count', imei, info.count);
        pipe.hset(
          'ops:unknown_imei_last',
          imei,
          JSON.stringify({
            lastSeen: now,
            latitude: info.latitude,
            longitude: info.longitude,
          }),
        );
        pipe.hsetnx('ops:unknown_imei_first', imei, String(now));
      }
      if (unknownImeis.size > 0) {
        pipe.expire('ops:unknown_imei_count', TTL);
        pipe.expire('ops:unknown_imei_last', TTL);
        pipe.expire('ops:unknown_imei_first', TTL);
      }
      await pipe.exec();
    } catch (err) {
      this.logger.error('Failed to record telemetry discard counters', err);
    }
  }
}
