import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Event } from '../events/event.entity';
import { Geofence } from '../geofences/geofence.entity';
import { Driver } from '../drivers/driver.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

export interface ReportQuery {
  from: string;
  to: string;
  deviceId?: string;
  vehicleId?: string;
  driverId?: string;
  geofenceId?: string;
  eventType?: string;
  speedLimit?: number;
  minDuration?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(Geofence)
    private readonly geofences: Repository<Geofence>,
    @InjectRepository(Driver)
    private readonly drivers: Repository<Driver>,
  ) {}

  private tenantFilter(user: AuthenticatedUser) {
    if (user.isSuperUser || !user.tenantId) return '';
    return `AND d."tenantId" = '${user.tenantId}'`;
  }

  private async getDevicesForUser(user: AuthenticatedUser) {
    const qb = this.devices
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.vehicle', 'v');
    if (!user.isSuperUser && user.tenantId) {
      qb.where('d.tenantId = :tenantId', { tenantId: user.tenantId });
    }
    return qb.getMany();
  }

  // 1. Vehicle Trip Report
  async vehicleTripReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const qb = this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('r.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('r.timestamp >= :from', { from: q.from })
      .andWhere('r.timestamp <= :to', { to: q.to })
      .orderBy('r.timestamp', 'ASC');

    if (q.deviceId) qb.andWhere('r.deviceId = :deviceId', { deviceId: q.deviceId });

    const readings = await qb.getMany();

    // Group by device and split into trips (gap > 5 min = new trip)
    const trips: any[] = [];
    const byDevice = new Map<string, typeof readings>();
    for (const r of readings) {
      const arr = byDevice.get(r.deviceId) || [];
      arr.push(r);
      byDevice.set(r.deviceId, arr);
    }

    for (const [deviceId, deviceReadings] of byDevice) {
      const device = devices.find((d) => d.id === deviceId);
      const plate = device?.vehicle?.plateNumber ?? deviceId.slice(0, 8);
      let tripStart = 0;

      for (let i = 1; i <= deviceReadings.length; i++) {
        const gap =
          i < deviceReadings.length
            ? new Date(deviceReadings[i].timestamp).getTime() -
              new Date(deviceReadings[i - 1].timestamp).getTime()
            : Infinity;

        if (gap > 5 * 60 * 1000 || i === deviceReadings.length) {
          const seg = deviceReadings.slice(tripStart, i);
          if (seg.length < 2) { tripStart = i; continue; }

          let dist = 0;
          for (let j = 1; j < seg.length; j++) {
            dist += this.haversine(
              Number(seg[j - 1].latitude), Number(seg[j - 1].longitude),
              Number(seg[j].latitude), Number(seg[j].longitude),
            );
          }
          const start = seg[0];
          const end = seg[seg.length - 1];
          const dur =
            (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 1000;
          const speeds = seg.filter((s) => s.speed != null).map((s) => Number(s.speed));
          const avgSpd = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
          const maxSpd = speeds.length ? Math.max(...speeds) : 0;

          trips.push({
            plateNumber: plate,
            deviceId,
            startTime: start.timestamp,
            endTime: end.timestamp,
            durationSec: Math.round(dur),
            distanceKm: Math.round(dist * 100) / 100,
            avgSpeed: Math.round(avgSpd * 100) / 100,
            maxSpeed: Math.round(maxSpd * 100) / 100,
            startLat: Number(start.latitude),
            startLon: Number(start.longitude),
            endLat: Number(end.latitude),
            endLon: Number(end.longitude),
            points: seg.map((s) => ({
              lat: Number(s.latitude),
              lon: Number(s.longitude),
              ts: s.timestamp,
            })),
          });
          tripStart = i;
        }
      }
    }

    return trips.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  // 2. Daily Summary
  async dailySummaryReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const qb = this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('r.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('r.timestamp >= :from', { from: q.from })
      .andWhere('r.timestamp <= :to', { to: q.to })
      .orderBy('r.timestamp', 'ASC');

    if (q.deviceId) qb.andWhere('r.deviceId = :deviceId', { deviceId: q.deviceId });

    const readings = await qb.getMany();
    const byDevice = new Map<string, typeof readings>();
    for (const r of readings) {
      const arr = byDevice.get(r.deviceId) || [];
      arr.push(r);
      byDevice.set(r.deviceId, arr);
    }

    const summaries: any[] = [];
    for (const [deviceId, devs] of byDevice) {
      const device = devices.find((d) => d.id === deviceId);
      let totalDist = 0;
      let movingTime = 0;
      let idleTime = 0;
      let stopTime = 0;
      const speeds: number[] = [];
      let maxSpeed = 0;
      let stops = 0;
      let wasStopped = false;

      for (let i = 1; i < devs.length; i++) {
        const dist = this.haversine(
          Number(devs[i - 1].latitude), Number(devs[i - 1].longitude),
          Number(devs[i].latitude), Number(devs[i].longitude),
        );
        totalDist += dist;
        const dt =
          (new Date(devs[i].timestamp).getTime() -
            new Date(devs[i - 1].timestamp).getTime()) /
          1000;
        const spd = devs[i].speed != null ? Number(devs[i].speed) : 0;
        speeds.push(spd);
        if (spd > maxSpeed) maxSpeed = spd;

        if (devs[i].movement === 'MOVING') {
          movingTime += dt;
          wasStopped = false;
        } else if (devs[i].movement === 'IDLE') {
          idleTime += dt;
        } else if (devs[i].movement === 'STOPPED') {
          stopTime += dt;
          if (!wasStopped) stops++;
          wasStopped = true;
        }
      }

      const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      summaries.push({
        plateNumber: device?.vehicle?.plateNumber ?? deviceId.slice(0, 8),
        deviceId,
        totalDistanceKm: Math.round(totalDist * 100) / 100,
        movingTimeSec: Math.round(movingTime),
        idleTimeSec: Math.round(idleTime),
        stopTimeSec: Math.round(stopTime),
        avgSpeed: Math.round(avgSpeed * 100) / 100,
        maxSpeed: Math.round(maxSpeed * 100) / 100,
        stopCount: stops,
        readingCount: devs.length,
      });
    }

    return summaries;
  }

  // 3. Speed Violation Report
  async speedViolationReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const speedLimit = q.speedLimit ?? 120;

    const readings = await this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('r.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('r.timestamp >= :from', { from: q.from })
      .andWhere('r.timestamp <= :to', { to: q.to })
      .andWhere('r.speed > :speedLimit', { speedLimit })
      .orderBy('r.timestamp', 'ASC')
      .getMany();

    return readings.map((r) => ({
      plateNumber: (r.device as any)?.vehicle?.plateNumber ?? r.deviceId.slice(0, 8),
      deviceId: r.deviceId,
      timestamp: r.timestamp,
      speed: Number(r.speed),
      speedLimit,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    }));
  }

  // 4. Idle/Stoppage Report
  async idleReport(user: AuthenticatedUser, q: ReportQuery) {
    const events = await this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('e.eventType IN (:...types)', { types: ['IDLE', 'STOPPAGE'] })
      .andWhere('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to })
      .orderBy('e.startedAt', 'ASC')
      .getMany();

    return events
      .filter((e) => {
        if (!e.endedAt) return true;
        const dur =
          (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 1000;
        return dur >= (q.minDuration ?? 0);
      })
      .map((e) => ({
        plateNumber: (e.device as any)?.vehicle?.plateNumber ?? e.deviceId.slice(0, 8),
        deviceId: e.deviceId,
        eventType: e.eventType,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        durationSec: e.endedAt
          ? Math.round(
              (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 1000,
            )
          : null,
        latitude: e.latitude != null ? Number(e.latitude) : null,
        longitude: e.longitude != null ? Number(e.longitude) : null,
      }));
  }

  // 5. Ignition Report
  async ignitionReport(user: AuthenticatedUser, q: ReportQuery) {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('e.eventType IN (:...types)', { types: ['IGNITION_ON', 'IGNITION_OFF'] })
      .andWhere('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to })
      .orderBy('e.startedAt', 'ASC');

    if (q.deviceId) qb.andWhere('e.deviceId = :deviceId', { deviceId: q.deviceId });

    const events = await qb.getMany();
    return events.map((e) => ({
      plateNumber: (e.device as any)?.vehicle?.plateNumber ?? e.deviceId.slice(0, 8),
      deviceId: e.deviceId,
      eventType: e.eventType,
      timestamp: e.startedAt,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
    }));
  }

  // 6. Geofence Entry/Exit Report
  async geofenceEntryExitReport(user: AuthenticatedUser, q: ReportQuery) {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('e.eventType IN (:...types)', { types: ['GEOFENCE_IN', 'GEOFENCE_OUT'] })
      .andWhere('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to })
      .orderBy('e.startedAt', 'ASC');

    if (q.geofenceId) {
      qb.andWhere("e.metadata->>'geofenceId' = :gfId", { gfId: q.geofenceId });
    }

    const events = await qb.getMany();
    return events.map((e) => ({
      plateNumber: (e.device as any)?.vehicle?.plateNumber ?? e.deviceId.slice(0, 8),
      deviceId: e.deviceId,
      eventType: e.eventType,
      geofenceName: e.metadata?.geofenceName ?? 'Unknown',
      timestamp: e.startedAt,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
    }));
  }

  // 7. Geofence Summary
  async geofenceSummaryReport(user: AuthenticatedUser, q: ReportQuery) {
    const events = await this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where("e.eventType = 'GEOFENCE_IN'")
      .andWhere('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to })
      .getMany();

    const byGeofence = new Map<string, any[]>();
    for (const e of events) {
      const name = e.metadata?.geofenceName ?? 'Unknown';
      const arr = byGeofence.get(name) || [];
      arr.push(e);
      byGeofence.set(name, arr);
    }

    return Array.from(byGeofence.entries()).map(([name, evts]) => ({
      geofenceName: name,
      totalVisits: evts.length,
      uniqueVehicles: new Set(evts.map((e) => e.deviceId)).size,
      timestamps: evts.map((e) => e.startedAt),
    }));
  }

  // 8. Event Log
  async eventLogReport(user: AuthenticatedUser, q: ReportQuery) {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to })
      .orderBy('e.startedAt', 'ASC');

    if (q.eventType) qb.andWhere('e.eventType = :eventType', { eventType: q.eventType });
    if (q.deviceId) qb.andWhere('e.deviceId = :deviceId', { deviceId: q.deviceId });

    const events = await qb.getMany();
    return events.map((e) => ({
      id: e.id,
      plateNumber: (e.device as any)?.vehicle?.plateNumber ?? e.deviceId.slice(0, 8),
      deviceId: e.deviceId,
      eventType: e.eventType,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      speed: e.speed != null ? Number(e.speed) : null,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
      acknowledged: e.acknowledged,
    }));
  }

  // 9. Driver Activity
  async driverActivityReport(user: AuthenticatedUser, q: ReportQuery) {
    const drivers = await this.drivers.find({ relations: ['vehicle'] });
    const summaries: any[] = [];

    for (const driver of drivers) {
      if (!driver.vehicle) continue;
      if (q.driverId && driver.id !== q.driverId) continue;

      const device = await this.devices.findOne({
        where: { vehicleId: driver.vehicle.id },
      });
      if (!device) continue;

      const tripReport = await this.vehicleTripReport(user, {
        ...q,
        deviceId: device.id,
      });
      const eventCount = await this.events.count({
        where: {
          deviceId: device.id,
          startedAt: (() => {
            const qb = this.events.createQueryBuilder('e');
            return undefined;
          })() as any,
        },
      });

      const totalDistance = tripReport.reduce((sum: number, t: any) => sum + t.distanceKm, 0);
      const totalTrips = tripReport.length;

      summaries.push({
        driverName: `${driver.firstName} ${driver.lastName}`,
        licenseNumber: driver.licenseNumber,
        plateNumber: driver.vehicle.plateNumber,
        totalTrips,
        totalDistanceKm: Math.round(totalDistance * 100) / 100,
        avgSpeed: tripReport.length
          ? Math.round(
              tripReport.reduce((s: number, t: any) => s + t.avgSpeed, 0) /
                tripReport.length *
                100,
            ) / 100
          : 0,
      });
    }

    return summaries;
  }

  // 10. Device Health
  async deviceHealthReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const readings = await this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('r.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('r.timestamp >= :from', { from: q.from })
      .andWhere('r.timestamp <= :to', { to: q.to })
      .orderBy('r.timestamp', 'ASC')
      .getMany();

    const byDevice = new Map<string, typeof readings>();
    for (const r of readings) {
      const arr = byDevice.get(r.deviceId) || [];
      arr.push(r);
      byDevice.set(r.deviceId, arr);
    }

    return Array.from(byDevice.entries()).map(([deviceId, devs]) => {
      const device = devices.find((d) => d.id === deviceId);
      const batteries = devs.filter((d) => d.batteryV != null).map((d) => Number(d.batteryV));
      const signals = devs.filter((d) => d.gsmSignal != null).map((d) => Number(d.gsmSignal));

      return {
        plateNumber: device?.vehicle?.plateNumber ?? deviceId.slice(0, 8),
        deviceId,
        imei: device?.imei ?? '',
        readingCount: devs.length,
        battery: batteries.length
          ? {
              min: Math.min(...batteries),
              max: Math.max(...batteries),
              avg: Math.round((batteries.reduce((a, b) => a + b, 0) / batteries.length) * 100) / 100,
            }
          : null,
        signal: signals.length
          ? {
              min: Math.min(...signals),
              max: Math.max(...signals),
              avg: Math.round((signals.reduce((a, b) => a + b, 0) / signals.length) * 100) / 100,
            }
          : null,
        firstReading: devs[0]?.timestamp,
        lastReading: devs[devs.length - 1]?.timestamp,
      };
    });
  }

  // 11. Travel Distance Report
  async travelDistanceReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const qb = this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('r.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('r.timestamp >= :from', { from: q.from })
      .andWhere('r.timestamp <= :to', { to: q.to })
      .orderBy('r.timestamp', 'ASC');

    if (q.deviceId) qb.andWhere('r.deviceId = :deviceId', { deviceId: q.deviceId });

    const readings = await qb.getMany();
    const byDevice = new Map<string, typeof readings>();
    for (const r of readings) {
      const arr = byDevice.get(r.deviceId) || [];
      arr.push(r);
      byDevice.set(r.deviceId, arr);
    }

    const results: any[] = [];
    for (const [deviceId, devs] of byDevice) {
      const device = devices.find((d) => d.id === deviceId);
      let totalDist = 0;
      let movingTime = 0;
      let tripCount = 0;
      let lastTripEnd = 0;

      for (let i = 1; i < devs.length; i++) {
        const gap = new Date(devs[i].timestamp).getTime() - new Date(devs[i - 1].timestamp).getTime();
        if (gap > 5 * 60 * 1000) {
          tripCount++;
        }

        const dist = this.haversine(
          Number(devs[i - 1].latitude), Number(devs[i - 1].longitude),
          Number(devs[i].latitude), Number(devs[i].longitude),
        );
        totalDist += dist;

        if (devs[i].movement === 'MOVING') {
          movingTime += gap / 1000;
        }
        lastTripEnd = i;
      }

      if (devs.length >= 2) tripCount++;

      const speeds = devs.filter((d) => d.speed != null).map((d) => Number(d.speed));
      const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

      results.push({
        plateNumber: device?.vehicle?.plateNumber ?? deviceId.slice(0, 8),
        make: device?.vehicle?.make ?? '',
        model: device?.vehicle?.model ?? '',
        deviceId,
        totalDistanceKm: Math.round(totalDist * 100) / 100,
        tripCount,
        movingTimeSec: Math.round(movingTime),
        avgSpeed: Math.round(avgSpeed * 100) / 100,
        maxSpeed: Math.round(maxSpeed * 100) / 100,
        firstSeen: devs[0]?.timestamp,
        lastSeen: devs[devs.length - 1]?.timestamp,
        startLat: devs[0] ? Number(devs[0].latitude) : null,
        startLon: devs[0] ? Number(devs[0].longitude) : null,
        endLat: devs[lastTripEnd] ? Number(devs[lastTripEnd].latitude) : null,
        endLon: devs[lastTripEnd] ? Number(devs[lastTripEnd].longitude) : null,
      });
    }

    return results.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
