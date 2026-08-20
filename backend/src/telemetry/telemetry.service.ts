import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';

export interface TelemetryQueryDto {
  page?: number;
  limit?: number;
  imei?: string;
  deviceId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
  ) {}

  async findAll(query: TelemetryQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'device');

    if (query.imei) {
      qb.andWhere('device.imei LIKE :imei', { imei: `%${query.imei}%` });
    }
    if (query.deviceId) {
      qb.andWhere('r.deviceId = :deviceId', { deviceId: query.deviceId });
    }
    if (query.from) {
      qb.andWhere('r.timestamp >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('r.timestamp <= :to', { to: query.to });
    }

    const [data, total] = await qb
      .orderBy('r.timestamp', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findLatestPerDevice() {
    const latestPerDevice = await this.readings
      .createQueryBuilder('r')
      .innerJoin(
        (sub) => {
          return sub
            .select('r2.deviceId', 'deviceId')
            .addSelect('MAX(r2.timestamp)', 'maxTimestamp')
            .from(GPSReading, 'r2')
            .groupBy('r2.deviceId');
        },
        'latest',
        'r.deviceId = latest.deviceId AND r.timestamp = latest.maxTimestamp',
      )
      .leftJoinAndSelect('r.device', 'device')
      .addSelect([
        'r.latitudeCleaned',
        'r.longitudeCleaned',
      ])
      .getMany();

    return latestPerDevice.map((r) => ({
      ...r,
      latitude: r.latitudeCleaned != null ? Number(r.latitudeCleaned) : Number(r.latitude),
      longitude: r.longitudeCleaned != null ? Number(r.longitudeCleaned) : Number(r.longitude),
    }));
  }

  async findTodayTrail(deviceId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const readings = await this.readings
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.latitude',
        'r.longitude',
        'r.latitudeCleaned',
        'r.longitudeCleaned',
        'r.speed',
        'r.heading',
        'r.ignition',
        'r.movement',
        'r.timestamp',
      ])
      .where('r.deviceId = :deviceId', { deviceId })
      .andWhere('r.timestamp >= :startOfDay', { startOfDay })
      .orderBy('r.timestamp', 'ASC')
      .getMany();

    return readings.map((r) => ({
      latitude: r.latitudeCleaned != null ? Number(r.latitudeCleaned) : Number(r.latitude),
      longitude: r.longitudeCleaned != null ? Number(r.longitudeCleaned) : Number(r.longitude),
      speed: r.speed != null ? Number(r.speed) : null,
      heading: r.heading,
      ignition: r.ignition,
      movement: r.movement,
      timestamp: r.timestamp,
    }));
  }
}
