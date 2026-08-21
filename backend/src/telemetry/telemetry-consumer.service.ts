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
    const detectionInputs: {
      deviceId: string;
      imei: string;
      tenantId: string;
      latitude?: number;
      longitude?: number;
      speed?: number;
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
        const data: TelemetryPayload = JSON.parse(rawPayload);

        if (!data.imei || data.latitude == null || data.longitude == null) {
          this.logger.warn(
            `Skipping message ${messageId}: missing required fields`,
          );
          idsToAck.push(messageId);
          continue;
        }

        // Skip invalid GPS fixes
        if (data.fix_valid === false) {
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

    if (readings.length === 0) return;

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
            heading: null,
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
  }
}
