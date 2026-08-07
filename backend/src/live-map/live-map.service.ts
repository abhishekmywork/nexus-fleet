import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

export interface PositionResponse {
  deviceId: string;
  imei: string;
  vehicleId: string | null;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  odometerKm: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  timestamp: string;
}

@Injectable()
export class LiveMapService {
  private readonly logger = new Logger(LiveMapService.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
  ) {}

  async getActivePositions(user: AuthenticatedUser): Promise<PositionResponse[]> {
    const tenantFilter =
      user.isSuperUser || !user.tenantId ? {} : { tenantId: user.tenantId };

    const devices = await this.devices
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.vehicle', 'vehicle')
      .where(
        Object.keys(tenantFilter).length ? 'device.tenantId = :tenantId' : '1=1',
        tenantFilter,
      )
      .getMany();

    const results: PositionResponse[] = [];

    for (const device of devices) {
      const latest = await this.readings
        .createQueryBuilder('r')
        .where('r.deviceId = :deviceId', { deviceId: device.id })
        .orderBy('r.timestamp', 'DESC')
        .getOne();

      if (!latest) continue;

      const vehicle = device.vehicle as any;

      results.push({
        deviceId: device.id,
        imei: device.imei,
        vehicleId: device.vehicleId,
        plateNumber: vehicle?.plateNumber ?? null,
        make: vehicle?.make ?? null,
        model: vehicle?.model ?? null,
        status: vehicle?.status ?? null,
        latitude: Number(latest.latitude),
        longitude: Number(latest.longitude),
        speed: latest.speed != null ? Number(latest.speed) : null,
        heading: latest.heading ?? null,
        ignition: latest.ignition ?? null,
        movement: latest.movement ?? null,
        odometerKm: latest.odometerKm != null ? Number(latest.odometerKm) : null,
        batteryV: latest.batteryV != null ? Number(latest.batteryV) : null,
        gsmSignal: latest.gsmSignal != null ? Number(latest.gsmSignal) : null,
        timestamp: latest.timestamp?.toISOString?.() ?? new Date().toISOString(),
      });
    }

    return results;
  }
}
