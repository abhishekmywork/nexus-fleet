import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GlobalSettingsService } from '../settings/global-settings.service';

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
    private readonly globalSettings: GlobalSettingsService,
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

  private pickCoord(raw: any, cleaned: any, useCorrected: boolean): number {
    if (useCorrected && cleaned != null) return Number(cleaned);
    return Number(raw);
  }

  async findLatestPerDevice() {
    const useCorrected = await this.globalSettings.isCorrectedCoordsEnabled();

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
      latitude: this.pickCoord(r.latitude, r.latitudeCleaned, useCorrected),
      longitude: this.pickCoord(r.longitude, r.longitudeCleaned, useCorrected),
    }));
  }

  async findTodayTrail(deviceId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const OSRM_URL = process.env.OSRM_URL || 'http://osrm:5000';
    const useCorrected = await this.globalSettings.isCorrectedCoordsEnabled();

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

    const points = readings.map((r) => ({
      latitude: this.pickCoord(r.latitude, r.latitudeCleaned, useCorrected),
      longitude: this.pickCoord(r.longitude, r.longitudeCleaned, useCorrected),
      speed: r.speed != null ? Number(r.speed) : null,
      heading: r.heading,
      ignition: r.ignition,
      movement: r.movement,
      timestamp: r.timestamp,
    }));

    let routeGeometry: { lat: number; lng: number }[] | null = null;

    if (points.length >= 2) {
      try {
        const MAX_WAYPOINTS = 100;
        let sampled = points;
        if (points.length > MAX_WAYPOINTS) {
          const step = Math.ceil((points.length - 2) / (MAX_WAYPOINTS - 2));
          sampled = [points[0]];
          for (let i = 1; i < points.length - 1; i += step) {
            sampled.push(points[i]);
          }
          sampled.push(points[points.length - 1]);
        }

        const coords = sampled.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(';');
        const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes?.length > 0) {
          const geoCoords: [number, number][] = data.routes[0].geometry.coordinates;
          routeGeometry = geoCoords.map((c) => ({ lat: c[1], lng: c[0] }));
        }
      } catch (err) {
        // fallback: no road geometry, frontend will use straight lines
      }
    }

    return { points, routeGeometry };
  }
}
