import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

interface VehicleWithPosition {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  lastSeen: string | null;
}

export interface NearestResult {
  vehicle: { id: string; plateNumber: string; make: string; model: string };
  distance_km: number;
  duration_min: number;
  latitude: number;
  longitude: number;
}

@Injectable()
export class NearestVehicleService {
  private readonly logger = new Logger(NearestVehicleService.name);
  private readonly osrmUrl = process.env.OSRM_URL || 'http://osrm:5000';

  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(GPSDevice) private readonly devices: Repository<GPSDevice>,
    @InjectRepository(GPSReading) private readonly readings: Repository<GPSReading>,
  ) {}

  private buildTenantFilter(user: AuthenticatedUser) {
    if (user.isSuperUser) return {};
    return { tenantId: user.tenantId };
  }

  async getVehiclePositions(user: AuthenticatedUser): Promise<VehicleWithPosition[]> {
    const tenantFilter = this.buildTenantFilter(user);
    const vehicles = await this.vehicles
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.gpsDevice', 'device')
      .where(tenantFilter.tenantId ? 'v.tenantId = :tenantId' : '1=1', {
        ...(tenantFilter.tenantId ? { tenantId: user.tenantId } : {}),
      })
      .getMany();

    const result: VehicleWithPosition[] = [];
    for (const v of vehicles) {
      if (!v.gpsDevice) continue;
      const latest = await this.readings
        .createQueryBuilder('r')
        .where('r.deviceId = :deviceId', { deviceId: v.gpsDevice.id })
        .orderBy('r.timestamp', 'DESC')
        .getOne();
      if (latest && latest.latitude != null && latest.longitude != null) {
        result.push({
          id: v.id,
          plateNumber: v.plateNumber,
          make: v.make,
          model: v.model,
          latitude: Number(latest.latitude),
          longitude: Number(latest.longitude),
          speed: latest.speed != null ? Number(latest.speed) : null,
          heading: latest.heading ?? null,
          lastSeen: latest.timestamp?.toISOString?.() ?? null,
        });
      }
    }
    return result;
  }

  async findNearest(user: AuthenticatedUser, vehicleId: string) {
    const all = await this.getVehiclePositions(user);
    const ref = all.find((v) => v.id === vehicleId);
    if (!ref) {
      return { reference: null, results: [] };
    }

    const others = all.filter((v) => v.id !== vehicleId);
    if (others.length === 0) {
      return {
        reference: {
          id: ref.id,
          plateNumber: ref.plateNumber,
          make: ref.make,
          model: ref.model,
          latitude: ref.latitude,
          longitude: ref.longitude,
        },
        results: [],
      };
    }

    // Try OSRM table API for road distances
    const coords = [
      `${ref.longitude},${ref.latitude}`,
      ...others.map((v) => `${v.longitude},${v.latitude}`),
    ];

    try {
      const url = `${this.osrmUrl}/table/v1/driving/${coords[0]};${coords.slice(1).join(';')}?annotations=distance,duration`;
      this.logger.log(`OSRM request: ${url.substring(0, 200)}...`);
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.code === 'Ok' && data.distances && data.durations) {
        const distances = data.distances[0]; // from reference to all others
        const durations = data.durations[0];

        const results: NearestResult[] = others
          .map((v, i) => ({
            vehicle: { id: v.id, plateNumber: v.plateNumber, make: v.make, model: v.model },
            distance_km: Math.round((distances[i + 1] / 1000) * 100) / 100,
            duration_min: Math.round((durations[i + 1] / 60) * 10) / 10,
            latitude: v.latitude,
            longitude: v.longitude,
          }))
          .sort((a, b) => a.distance_km - b.distance_km);

        return {
          reference: {
            id: ref.id,
            plateNumber: ref.plateNumber,
            make: ref.make,
            model: ref.model,
            latitude: ref.latitude,
            longitude: ref.longitude,
          },
          results,
        };
      }
      this.logger.warn(`OSRM returned: ${data.code}`);
    } catch (err) {
      this.logger.error(`OSRM error: ${err}`);
    }

    // Fallback: straight-line distance using Haversine
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const results: NearestResult[] = others
      .map((v) => ({
        vehicle: { id: v.id, plateNumber: v.plateNumber, make: v.make, model: v.model },
        distance_km: Math.round(haversine(ref.latitude, ref.longitude, v.latitude, v.longitude) * 100) / 100,
        duration_min: 0,
        latitude: v.latitude,
        longitude: v.longitude,
      }))
      .sort((a, b) => a.distance_km - b.distance_km);

    return {
      reference: {
        id: ref.id,
        plateNumber: ref.plateNumber,
        make: ref.make,
        model: ref.model,
        latitude: ref.latitude,
        longitude: ref.longitude,
      },
      results,
    };
  }
}
