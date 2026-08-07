import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

@Injectable()
export class MobileService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(GPSDevice) private readonly devices: Repository<GPSDevice>,
    @InjectRepository(GPSReading) private readonly readings: Repository<GPSReading>,
  ) {}

  async registerFcmToken(
    user: AuthenticatedUser,
    token: string,
    platform: string,
  ) {
    return { success: true, token, platform };
  }

  async getMyVehicle(user: AuthenticatedUser) {
    const dbUser = await this.users.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('User not found');

    // Link user to driver via matching firstName + lastName + tenantId
    if (!dbUser.tenantId) return null;
    const driver = await this.drivers.findOne({
      where: {
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        tenantId: dbUser.tenantId,
      },
    });

    if (!driver || !driver.vehicleId) return null;

    const vehicle = await this.vehicles.findOne({
      where: { id: driver.vehicleId },
      relations: ['driver', 'gpsDevice'],
    });

    if (!vehicle) return null;

    let latestPosition = null;
    if (vehicle.gpsDevice) {
      const latestReading = await this.readings.findOne({
        where: { deviceId: vehicle.gpsDevice.id },
        order: { timestamp: 'DESC' },
      });
      if (latestReading) {
        latestPosition = {
          latitude: Number(latestReading.latitude),
          longitude: Number(latestReading.longitude),
          speed: latestReading.speed != null ? Number(latestReading.speed) : null,
          timestamp: latestReading.timestamp,
        };
      }
    }

    return {
      vehicle: {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
      },
      latestPosition,
    };
  }

  async toggleDuty(user: AuthenticatedUser, active: boolean) {
    return {
      userId: user.id,
      dutyActive: active,
      startedAt: active ? new Date().toISOString() : null,
    };
  }
}
