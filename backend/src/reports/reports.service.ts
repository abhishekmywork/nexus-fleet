import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Event } from '../events/event.entity';
import { Geofence } from '../geofences/geofence.entity';
import { Driver } from '../drivers/driver.entity';
import { GlobalSettingsService } from '../settings/global-settings.service';
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
    private readonly globalSettings: GlobalSettingsService,
  ) {}

  private tenantFilter(user: AuthenticatedUser) {
    if (user.isSuperUser || !user.tenantId) return '';
    return `AND d."tenantId" = '${user.tenantId}'`;
  }

  private async getCoordMode() {
    return this.globalSettings.isCorrectedCoordsEnabled();
  }

  private latExpr(useCorrected: boolean, alias = 'r') {
    return useCorrected ? `COALESCE(${alias}."latitudeCleaned", ${alias}.latitude)` : `${alias}.latitude`;
  }

  private lonExpr(useCorrected: boolean, alias = 'r') {
    return useCorrected ? `COALESCE(${alias}."longitudeCleaned", ${alias}.longitude)` : `${alias}.longitude`;
  }

  private pickCoord(raw: any, cleaned: any, useCorrected: boolean): number {
    if (useCorrected && cleaned != null) return Number(cleaned);
    return Number(raw);
  }

  private async getDevicesForUser(user: AuthenticatedUser, vehicleId?: string) {
    const qb = this.devices
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.vehicle', 'v');
    if (!user.isSuperUser && user.tenantId) {
      qb.where('d.tenantId = :tenantId', { tenantId: user.tenantId });
    }
    if (vehicleId) {
      qb.andWhere('d.vehicleId = :vehicleId', { vehicleId });
    }
    return qb.getMany();
  }

  // 1. Vehicle Trip Report
  async vehicleTripReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user, q.vehicleId);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const useCorrected = await this.getCoordMode();

    const qb = this.readings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .addSelect([
        'r.latitudeCleaned',
        'r.longitudeCleaned',
      ])
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
            const prevLat = this.pickCoord(seg[j - 1].latitude, seg[j - 1].latitudeCleaned, useCorrected);
            const prevLon = this.pickCoord(seg[j - 1].longitude, seg[j - 1].longitudeCleaned, useCorrected);
            const curLat = this.pickCoord(seg[j].latitude, seg[j].latitudeCleaned, useCorrected);
            const curLon = this.pickCoord(seg[j].longitude, seg[j].longitudeCleaned, useCorrected);
            dist += this.haversine(prevLat, prevLon, curLat, curLon);
          }
          const start = seg[0];
          const end = seg[seg.length - 1];
          const dur =
            (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 1000;
          const speeds = seg.filter((s) => s.speed != null).map((s) => Number(s.speed));
          const avgSpd = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
          const maxSpd = speeds.length ? Math.max(...speeds) : 0;

          const roundedDist = Math.round(dist * 100) / 100;
          if (roundedDist === 0) { tripStart = i; continue; }

          trips.push({
            plateNumber: plate,
            deviceId,
            startTime: start.timestamp,
            endTime: end.timestamp,
            durationSec: Math.round(dur),
            distanceKm: roundedDist,
            avgSpeed: Math.round(avgSpd * 100) / 100,
            maxSpeed: Math.round(maxSpd * 100) / 100,
            startLat: this.pickCoord(start.latitude, start.latitudeCleaned, useCorrected),
            startLon: this.pickCoord(start.longitude, start.longitudeCleaned, useCorrected),
            endLat: this.pickCoord(end.latitude, end.latitudeCleaned, useCorrected),
            endLon: this.pickCoord(end.longitude, end.longitudeCleaned, useCorrected),
            points: seg.map((s) => ({
              lat: this.pickCoord(s.latitude, s.latitudeCleaned, useCorrected),
              lon: this.pickCoord(s.longitude, s.longitudeCleaned, useCorrected),
              ts: s.timestamp,
            })),
          });
          tripStart = i;
        }
      }
    }

    return trips.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  // 2. Daily Summary — SQL aggregation with earthdistance
  async dailySummaryReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user, q.vehicleId);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const useCorrected = await this.getCoordMode();
    const latE = this.latExpr(useCorrected);
    const lonE = this.lonExpr(useCorrected);

    const result = await this.readings.query(`
      WITH ordered AS (
        SELECT
          "deviceId",
          ${latE} AS latitude,
          ${lonE} AS longitude,
          speed,
          movement,
          timestamp,
          LAG(${latE}) OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS prev_lat,
          LAG(${lonE}) OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS prev_lon,
          LAG(timestamp) OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS prev_ts
        FROM gps_readings
        WHERE "deviceId" = ANY($1)
          AND timestamp >= $2
          AND timestamp <= $3
      ),
      dist_calc AS (
        SELECT
          "deviceId",
          speed,
          movement,
          timestamp,
          prev_lat,
          prev_lon,
          prev_ts,
          CASE
            WHEN prev_lat IS NOT NULL AND prev_lon IS NOT NULL
            THEN earth_distance(point(longitude, latitude), point(prev_lon, prev_lat)) / 1000.0
            ELSE 0
          END AS dist_km,
          CASE
            WHEN prev_ts IS NOT NULL
            THEN EXTRACT(EPOCH FROM (timestamp - prev_ts))
            ELSE 0
          END AS dt_sec
        FROM ordered
      )
      SELECT
        "deviceId",
        ROUND(SUM(dist_km)::numeric, 2) AS "totalDistanceKm",
        ROUND(SUM(CASE WHEN movement = 'MOVING' THEN dt_sec ELSE 0 END)::numeric, 0)::int AS "movingTimeSec",
        ROUND(SUM(CASE WHEN movement = 'IDLE' THEN dt_sec ELSE 0 END)::numeric, 0)::int AS "idleTimeSec",
        ROUND(SUM(CASE WHEN movement = 'STOPPED' THEN dt_sec ELSE 0 END)::numeric, 0)::int AS "stopTimeSec",
        ROUND(AVG(CASE WHEN speed IS NOT NULL THEN speed END)::numeric, 2)::float AS "avgSpeed",
        ROUND(MAX(COALESCE(speed, 0))::numeric, 2)::float AS "maxSpeed",
        COUNT(*)::int AS "readingCount"
      FROM dist_calc
      GROUP BY "deviceId"
    `, [deviceIds, q.from, q.to]);

    const deviceMap = new Map(devices.map((d) => [d.id, d]));
    return result.map((r: any) => {
      const device = deviceMap.get(r.deviceId);
      return {
        plateNumber: device?.vehicle?.plateNumber ?? r.deviceId.slice(0, 8),
        deviceId: r.deviceId,
        totalDistanceKm: Number(r.totalDistanceKm),
        movingTimeSec: Number(r.movingTimeSec),
        idleTimeSec: Number(r.idleTimeSec),
        stopTimeSec: Number(r.stopTimeSec),
        avgSpeed: Number(r.avgSpeed) || 0,
        maxSpeed: Number(r.maxSpeed) || 0,
        stopCount: 0,
        readingCount: Number(r.readingCount),
      };
    });
  }

  // 3. Speed Violation Report
  async speedViolationReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user, q.vehicleId);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const speedLimit = q.speedLimit ?? 120;
    const useCorrected = await this.getCoordMode();

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
      latitude: this.pickCoord(r.latitude, r.latitudeCleaned, useCorrected),
      longitude: this.pickCoord(r.longitude, r.longitudeCleaned, useCorrected),
    }));
  }

  // 4. Idle/Stoppage Report
  async idleReport(user: AuthenticatedUser, q: ReportQuery) {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('e.eventType IN (:...types)', { types: ['IDLE', 'STOPPAGE'] })
      .andWhere('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to })
      .orderBy('e.startedAt', 'ASC');

    if (q.deviceId) qb.andWhere('e.deviceId = :deviceId', { deviceId: q.deviceId });
    if (q.vehicleId) qb.andWhere('d."vehicleId" = :vehicleId', { vehicleId: q.vehicleId });

    const events = await qb.getMany();

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
    if (q.vehicleId) qb.andWhere('d."vehicleId" = :vehicleId', { vehicleId: q.vehicleId });

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
    if (q.deviceId) qb.andWhere('e.deviceId = :deviceId', { deviceId: q.deviceId });
    if (q.vehicleId) qb.andWhere('d."vehicleId" = :vehicleId', { vehicleId: q.vehicleId });

    const events = await qb.getMany();

    // Collect unique geofence IDs that need name lookup (old events without geofenceName)
    const geofenceIds = new Set<string>();
    for (const e of events) {
      if (!e.metadata?.geofenceName && e.metadata?.geofenceId) {
        geofenceIds.add(e.metadata.geofenceId);
      }
    }

    // Batch lookup geofence names for old events
    let geofenceMap = new Map<string, string>();
    if (geofenceIds.size > 0) {
      const geofences = await this.geofences
        .createQueryBuilder('gf')
        .select(['gf.id', 'gf.name'])
        .where('gf.id IN (:...ids)', { ids: Array.from(geofenceIds) })
        .getMany();
      geofenceMap = new Map(geofences.map((gf) => [gf.id, gf.name]));
    }

    return events.map((e) => ({
      plateNumber: (e.device as any)?.vehicle?.plateNumber ?? e.deviceId.slice(0, 8),
      deviceId: e.deviceId,
      eventType: e.eventType,
      geofenceName: e.metadata?.geofenceName
        ?? (e.metadata?.geofenceId ? geofenceMap.get(e.metadata.geofenceId) ?? 'Unknown' : 'Unknown'),
      timestamp: e.startedAt,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
    }));
  }

  // 7. Geofence Summary
  async geofenceSummaryReport(user: AuthenticatedUser, q: ReportQuery) {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'd')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where("e.eventType = 'GEOFENCE_IN'")
      .andWhere('e.startedAt >= :from', { from: q.from })
      .andWhere('e.startedAt <= :to', { to: q.to });

    if (q.deviceId) qb.andWhere('e.deviceId = :deviceId', { deviceId: q.deviceId });
    if (q.vehicleId) qb.andWhere('d."vehicleId" = :vehicleId', { vehicleId: q.vehicleId });

    const events = await qb.getMany();

    // Batch lookup geofence names for old events without geofenceName
    const geofenceIds = new Set<string>();
    for (const e of events) {
      if (!e.metadata?.geofenceName && e.metadata?.geofenceId) {
        geofenceIds.add(e.metadata.geofenceId);
      }
    }
    let geofenceMap = new Map<string, string>();
    if (geofenceIds.size > 0) {
      const geofences = await this.geofences
        .createQueryBuilder('gf')
        .select(['gf.id', 'gf.name'])
        .where('gf.id IN (:...ids)', { ids: Array.from(geofenceIds) })
        .getMany();
      geofenceMap = new Map(geofences.map((gf) => [gf.id, gf.name]));
    }

    const byGeofence = new Map<string, any[]>();
    for (const e of events) {
      const name = e.metadata?.geofenceName
        ?? (e.metadata?.geofenceId ? geofenceMap.get(e.metadata.geofenceId) ?? 'Unknown' : 'Unknown');
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
    if (q.vehicleId) qb.andWhere('d."vehicleId" = :vehicleId', { vehicleId: q.vehicleId });

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

  // 9. Driver Activity — single SQL query (no N+1)
  async driverActivityReport(user: AuthenticatedUser, q: ReportQuery) {
    const driverFilter = q.driverId ? `AND dr.id = '${q.driverId}'` : '';
    const vehicleFilter = q.vehicleId ? `AND v.id = '${q.vehicleId}'` : '';
    const useCorrected = await this.getCoordMode();
    const latE = this.latExpr(useCorrected, 'r');
    const lonE = this.lonExpr(useCorrected, 'r');

    const result = await this.readings.query(`
      WITH readings_with_gap AS (
        SELECT
          r."deviceId",
          r.speed,
          ${latE} AS latitude,
          ${lonE} AS longitude,
          r.timestamp,
          LAG(r.timestamp) OVER (PARTITION BY r."deviceId" ORDER BY r.timestamp) AS prev_ts,
          LAG(${latE}) OVER (PARTITION BY r."deviceId" ORDER BY r.timestamp) AS prev_lat,
          LAG(${lonE}) OVER (PARTITION BY r."deviceId" ORDER BY r.timestamp) AS prev_lon
        FROM gps_readings r
        JOIN gps_devices g ON g.id = r."deviceId"
        JOIN vehicles v ON v.id = g."vehicleId"
        JOIN drivers dr ON dr."vehicleId" = v.id
        WHERE r.timestamp >= $1
          AND r.timestamp <= $2
          ${driverFilter}
      ),
      dist_calc AS (
        SELECT
          "deviceId",
          speed,
          timestamp,
          CASE
            WHEN prev_lat IS NOT NULL AND prev_lon IS NOT NULL
            THEN earth_distance(point(longitude, latitude), point(prev_lon, prev_lat)) / 1000.0
            ELSE 0
          END AS dist_km,
          CASE
            WHEN prev_ts IS NOT NULL AND EXTRACT(EPOCH FROM (timestamp - prev_ts)) > 300 THEN 1
            ELSE 0
          END AS new_trip
        FROM readings_with_gap
      ),
      per_device AS (
        SELECT
          "deviceId",
          SUM(dist_km) AS total_distance,
          SUM(new_trip) + 1 AS trip_count,
          AVG(CASE WHEN speed IS NOT NULL THEN speed END) AS avg_speed,
          COUNT(*) AS reading_count
        FROM dist_calc
        GROUP BY "deviceId"
      )
      SELECT
        dr.id AS "driverId",
        dr."firstName",
        dr."lastName",
        dr."licenseNumber",
        v."plateNumber",
        COALESCE(pd.total_distance, 0) AS "totalDistanceKm",
        COALESCE(pd.trip_count, 0) AS "totalTrips",
        ROUND(COALESCE(pd.avg_speed, 0)::numeric, 2)::float AS "avgSpeed"
      FROM drivers dr
      JOIN vehicles v ON v.id = dr."vehicleId"
      LEFT JOIN gps_devices g ON g."vehicleId" = v.id
      LEFT JOIN per_device pd ON pd."deviceId" = g.id
      WHERE 1=1
        ${driverFilter}
        ${vehicleFilter}
      ORDER BY dr."firstName", dr."lastName"
    `, [q.from, q.to]);

    return result.map((r: any) => ({
      driverName: `${r.firstName} ${r.lastName}`,
      licenseNumber: r.licenseNumber,
      plateNumber: r.plateNumber,
      totalTrips: Number(r.totalTrips),
      totalDistanceKm: Math.round(Number(r.totalDistanceKm) * 100) / 100,
      avgSpeed: Number(r.avgSpeed) || 0,
    }));
  }

  // 10. Device Health — SQL aggregation
  async deviceHealthReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user, q.vehicleId);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const result = await this.readings.query(`
      SELECT
        "deviceId",
        COUNT(*)::int AS "readingCount",
        MIN("batteryV") AS "batteryMin",
        MAX("batteryV") AS "batteryMax",
        ROUND(AVG("batteryV")::numeric, 2)::float AS "batteryAvg",
        MIN("gsmSignal") AS "signalMin",
        MAX("gsmSignal") AS "signalMax",
        ROUND(AVG("gsmSignal")::numeric, 2)::float AS "signalAvg",
        MIN(timestamp) AS "firstReading",
        MAX(timestamp) AS "lastReading"
      FROM gps_readings
      WHERE "deviceId" = ANY($1)
        AND timestamp >= $2
        AND timestamp <= $3
      GROUP BY "deviceId"
    `, [deviceIds, q.from, q.to]);

    const deviceMap = new Map(devices.map((d) => [d.id, d]));
    return result.map((r: any) => {
      const device = deviceMap.get(r.deviceId);
      return {
        plateNumber: device?.vehicle?.plateNumber ?? r.deviceId.slice(0, 8),
        deviceId: r.deviceId,
        imei: device?.imei ?? '',
        readingCount: Number(r.readingCount),
        battery: r.batteryMin != null ? {
          min: Number(r.batteryMin),
          max: Number(r.batteryMax),
          avg: Number(r.batteryAvg),
        } : null,
        signal: r.signalMin != null ? {
          min: Number(r.signalMin),
          max: Number(r.signalMax),
          avg: Number(r.signalAvg),
        } : null,
        firstReading: r.firstReading,
        lastReading: r.lastReading,
      };
    });
  }

  // 11. Travel Distance Report — SQL aggregation with earthdistance
  async travelDistanceReport(user: AuthenticatedUser, q: ReportQuery) {
    const devices = await this.getDevicesForUser(user, q.vehicleId);
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    const deviceIdFilter = q.deviceId ? `AND r."deviceId" = '${q.deviceId}'` : '';
    const useCorrected = await this.getCoordMode();
    const latE = this.latExpr(useCorrected);
    const lonE = this.lonExpr(useCorrected);

    const result = await this.readings.query(`
      WITH ordered AS (
        SELECT
          "deviceId",
          ${latE} AS latitude,
          ${lonE} AS longitude,
          speed,
          movement,
          timestamp,
          LAG(${latE}) OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS prev_lat,
          LAG(${lonE}) OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS prev_lon,
          LAG(timestamp) OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS prev_ts
        FROM gps_readings r
        WHERE "deviceId" = ANY($1)
          AND timestamp >= $2
          AND timestamp <= $3
          ${deviceIdFilter}
      ),
      dist_calc AS (
        SELECT
          "deviceId",
          speed,
          movement,
          timestamp,
          prev_ts,
          CASE
            WHEN prev_lat IS NOT NULL AND prev_lon IS NOT NULL
            THEN earth_distance(point(longitude, latitude), point(prev_lon, prev_lat)) / 1000.0
            ELSE 0
          END AS dist_km,
          CASE
            WHEN prev_ts IS NOT NULL
            THEN EXTRACT(EPOCH FROM (timestamp - prev_ts))
            ELSE 0
          END AS dt_sec
        FROM ordered
      ),
      trip_markers AS (
        SELECT *,
          SUM(CASE WHEN prev_ts IS NULL OR EXTRACT(EPOCH FROM (timestamp - prev_ts)) > 300 THEN 1 ELSE 0 END)
            OVER (PARTITION BY "deviceId" ORDER BY timestamp) AS trip_group
        FROM dist_calc
      )
      SELECT
        t."deviceId",
        ROUND(SUM(t.dist_km)::numeric, 2) AS "totalDistanceKm",
        COUNT(DISTINCT t.trip_group)::int AS "tripCount",
        ROUND(SUM(CASE WHEN t.movement = 'MOVING' THEN t.dt_sec ELSE 0 END)::numeric, 0)::int AS "movingTimeSec",
        ROUND(AVG(CASE WHEN t.speed IS NOT NULL THEN t.speed END)::numeric, 2)::float AS "avgSpeed",
        ROUND(MAX(COALESCE(t.speed, 0))::numeric, 2)::float AS "maxSpeed",
        MIN(t.timestamp) AS "firstSeen",
        MAX(t.timestamp) AS "lastSeen",
        (ARRAY_AGG(COALESCE(t.latitude, 0) ORDER BY t.timestamp ASC))[1]::float AS "startLat",
        (ARRAY_AGG(COALESCE(t.longitude, 0) ORDER BY t.timestamp ASC))[1]::float AS "startLon",
        (ARRAY_AGG(COALESCE(t.latitude, 0) ORDER BY t.timestamp DESC))[1]::float AS "endLat",
        (ARRAY_AGG(COALESCE(t.longitude, 0) ORDER BY t.timestamp DESC))[1]::float AS "endLon"
      FROM trip_markers t
      GROUP BY t."deviceId"
      ORDER BY "totalDistanceKm" DESC
    `, [deviceIds, q.from, q.to]);

    const deviceMap = new Map(devices.map((d) => [d.id, d]));
    return result.map((r: any) => {
      const device = deviceMap.get(r.deviceId);
      return {
        plateNumber: device?.vehicle?.plateNumber ?? r.deviceId.slice(0, 8),
        make: device?.vehicle?.make ?? '',
        model: device?.vehicle?.model ?? '',
        deviceId: r.deviceId,
        totalDistanceKm: Number(r.totalDistanceKm),
        tripCount: Number(r.tripCount),
        movingTimeSec: Number(r.movingTimeSec),
        avgSpeed: Number(r.avgSpeed) || 0,
        maxSpeed: Number(r.maxSpeed) || 0,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        startLat: r.startLat != null ? Number(r.startLat) : null,
        startLon: r.startLon != null ? Number(r.startLon) : null,
        endLat: r.endLat != null ? Number(r.endLat) : null,
        endLon: r.endLon != null ? Number(r.endLon) : null,
      };
    });
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
