import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { Event, EventType } from '../events/event.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

export interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  inactiveVehicles: number;
  maintenanceVehicles: number;
  totalDevices: number;
  totalEvents: number;
  unacknowledgedEvents: number;
  eventsToday: number;
}

export interface EventTypeStat {
  eventType: string;
  count: number;
}

export interface RecentEvent {
  id: string;
  eventType: EventType;
  vehiclePlate: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  acknowledged: boolean;
  startedAt: string;
  createdAt: string;
}

export interface VehiclePosition {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  lastSeen: string | null;
}

export interface TelemetrySummaryEntry {
  deviceId: string;
  imei: string;
  vehiclePlate: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  odometerKm: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  temperatureC: number | null;
  timestamp: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
  ) {}

  async getStats(user: AuthenticatedUser): Promise<DashboardStats> {
    const tenantFilter = this.buildTenantFilter(user);

    const [totalVehicles, activeVehicles, inactiveVehicles, maintenanceVehicles] =
      await Promise.all([
        this.vehicles.count({ where: tenantFilter }),
        this.vehicles.count({ where: { ...tenantFilter, status: 'active' } }),
        this.vehicles.count({ where: { ...tenantFilter, status: 'inactive' } }),
        this.vehicles.count({ where: { ...tenantFilter, status: 'maintenance' } }),
      ]);

    const totalDevices = await this.devices.count({
      where: tenantFilter,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalEvents, unacknowledgedEvents, eventsToday] = await Promise.all([
      this.events.count({ where: tenantFilter }),
      this.events.count({ where: { ...tenantFilter, acknowledged: false } }),
      this.events.count({
        where: { ...tenantFilter, startedAt: todayStart as any },
      }),
    ]);

    return {
      totalVehicles,
      activeVehicles,
      inactiveVehicles,
      maintenanceVehicles,
      totalDevices,
      totalEvents,
      unacknowledgedEvents,
      eventsToday,
    };
  }

  async getEventsByType(user: AuthenticatedUser): Promise<EventTypeStat[]> {
    const tenantFilter = this.buildTenantFilter(user);

    const results = await this.events
      .createQueryBuilder('e')
      .select('e.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where(tenantFilter.tenantId ? 'e.tenantId = :tenantId' : '1=1', {
        ...(tenantFilter.tenantId ? { tenantId: tenantFilter.tenantId } : {}),
      })
      .groupBy('e.eventType')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      eventType: r.eventType,
      count: parseInt(r.count, 10),
    }));
  }

  async getRecentEvents(
    user: AuthenticatedUser,
    limit = 15,
  ): Promise<RecentEvent[]> {
    const tenantFilter = this.buildTenantFilter(user);

    const events = await this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'device')
      .leftJoinAndSelect('device.vehicle', 'vehicle')
      .where(tenantFilter.tenantId ? 'e.tenantId = :tenantId' : '1=1', {
        ...(tenantFilter.tenantId ? { tenantId: tenantFilter.tenantId } : {}),
      })
      .orderBy('e.startedAt', 'DESC')
      .take(limit)
      .getMany();

    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      vehiclePlate: (e.device as any)?.vehicle?.plateNumber ?? null,
      vehicleMake: (e.device as any)?.vehicle?.make ?? null,
      vehicleModel: (e.device as any)?.vehicle?.model ?? null,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
      speed: e.speed != null ? Number(e.speed) : null,
      acknowledged: e.acknowledged,
      startedAt: e.startedAt?.toISOString?.() ?? String(e.startedAt),
      createdAt: e.createdAt?.toISOString?.() ?? String(e.createdAt),
    }));
  }

  async getVehiclePositions(user: AuthenticatedUser): Promise<VehiclePosition[]> {
    const tenantFilter = this.buildTenantFilter(user);

    const vehicles = await this.vehicles
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.gpsDevice', 'device')
      .where(tenantFilter.tenantId ? 'v.tenantId = :tenantId' : '1=1', {
        ...(tenantFilter.tenantId ? { tenantId: tenantFilter.tenantId } : {}),
      })
      .getMany();

    const positions: VehiclePosition[] = [];
    for (const v of vehicles) {
      if (!v.gpsDevice) {
        positions.push({
          id: v.id,
          plateNumber: v.plateNumber,
          make: v.make,
          model: v.model,
          status: v.status,
          latitude: null,
          longitude: null,
          speed: null,
          heading: null,
          ignition: null,
          lastSeen: null,
        });
        continue;
      }

      const latest = await this.readings
        .createQueryBuilder('r')
        .where('r.deviceId = :deviceId', { deviceId: v.gpsDevice.id })
        .orderBy('r.timestamp', 'DESC')
        .getOne();

      positions.push({
        id: v.id,
        plateNumber: v.plateNumber,
        make: v.make,
        model: v.model,
        status: v.status,
        latitude: latest?.latitude != null ? Number(latest.latitude) : null,
        longitude: latest?.longitude != null ? Number(latest.longitude) : null,
        speed: latest?.speed != null ? Number(latest.speed) : null,
        heading: latest?.heading ?? null,
        ignition: latest?.ignition ?? null,
        lastSeen: latest?.timestamp?.toISOString?.() ?? null,
      });
    }

    return positions;
  }

  async getTelemetrySummary(
    user: AuthenticatedUser,
  ): Promise<TelemetrySummaryEntry[]> {
    const tenantFilter = this.buildTenantFilter(user);

    // Get all devices with their latest reading
    const devices = await this.devices
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.vehicle', 'vehicle')
      .where(
        tenantFilter.tenantId
          ? 'vehicle.tenantId = :tenantId'
          : '1=1',
        tenantFilter.tenantId ? { tenantId: tenantFilter.tenantId } : {},
      )
      .getMany();

    const results: TelemetrySummaryEntry[] = [];

    for (const device of devices) {
      const latest = await this.readings
        .createQueryBuilder('r')
        .where('r.deviceId = :deviceId', { deviceId: device.id })
        .orderBy('r.timestamp', 'DESC')
        .getOne();

      results.push({
        deviceId: device.id,
        imei: device.imei,
        vehiclePlate: (device as any).vehicle?.plateNumber ?? null,
        latitude: latest?.latitude != null ? Number(latest.latitude) : null,
        longitude: latest?.longitude != null ? Number(latest.longitude) : null,
        speed: latest?.speed != null ? Number(latest.speed) : null,
        heading: latest?.heading != null ? Number(latest.heading) : null,
        ignition: latest?.ignition ?? null,
        movement: latest?.movement ?? null,
        odometerKm: latest?.odometerKm != null ? Number(latest.odometerKm) : null,
        batteryV: latest?.batteryV != null ? Number(latest.batteryV) : null,
        gsmSignal: latest?.gsmSignal != null ? Number(latest.gsmSignal) : null,
        temperatureC: latest?.temperatureC != null ? Number(latest.temperatureC) : null,
        timestamp: latest?.timestamp?.toISOString?.() ?? new Date().toISOString(),
      });
    }

    return results;
  }

  private buildTenantFilter(user: AuthenticatedUser): Record<string, any> {
    if (user.isSuperUser || !user.tenantId) return {};
    return { tenantId: user.tenantId };
  }
}
