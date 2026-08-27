import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { Event } from '../events/event.entity';
import { Geofence } from '../geofences/geofence.entity';
import { Driver } from '../drivers/driver.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(Geofence)
    private readonly geofences: Repository<Geofence>,
    @InjectRepository(Driver)
    private readonly drivers: Repository<Driver>,
  ) {}

  private tenantCondSql(user: AuthenticatedUser, alias: string): string {
    const tenantCond = user.isSuperUser || !user.tenantId
      ? '1=1'
      : `${alias}."tenantId" = $1`;
    if (alias === 'v') {
      return `${tenantCond} AND ${alias}."deletedAt" IS NULL`;
    }
    return tenantCond;
  }

  private tenantVal(user: AuthenticatedUser): string | null {
    return user.isSuperUser || !user.tenantId ? null : user.tenantId;
  }

  private vehicleFilterSql(hasVehicle: boolean, offset: number): string {
    return hasVehicle ? `AND v.id = $${offset}` : '';
  }

  private defaultRange(from?: Date, to?: Date): { start: Date; end: Date } {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private buildParams(user: AuthenticatedUser, vehicleId?: string, extra?: Record<string, unknown>): any[] {
    const params: any[] = [];
    const tenantVal = this.tenantVal(user);
    if (tenantVal !== null) params.push(tenantVal);
    if (vehicleId) params.push(vehicleId);
    if (extra) {
      for (const v of Object.values(extra)) params.push(v);
    }
    return params;
  }

  async getOverview(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;
    const tCond = this.tenantCondSql(user, 'v');
    const vCond = this.vehicleFilterSql(hasVehicle, hasTenant ? 2 : 1);

    const whereParts = [tCond, '1=1'];
    const countParams: any[] = [];
    if (hasTenant) countParams.push(user.tenantId);
    if (hasVehicle) countParams.push(vehicleId);

    const [totalVehicles, activeVehicles, maintenanceVehicles] = await Promise.all([
      this.vehicles.query(
        `SELECT COUNT(*)::int AS "count" FROM vehicles v WHERE ${tCond} ${vCond}`,
        countParams,
      ),
      this.vehicles.query(
        `SELECT COUNT(*)::int AS "count" FROM vehicles v WHERE ${tCond} AND v.status = 'active' ${vCond}`,
        countParams,
      ),
      this.vehicles.query(
        `SELECT COUNT(*)::int AS "count" FROM vehicles v WHERE ${tCond} AND v.status = 'maintenance' ${vCond}`,
        countParams,
      ),
    ]);

    const activeDeviceCount = await this.devices.query(
      `SELECT COUNT(*)::int AS "count" FROM gps_devices d INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL WHERE ${tCond} ${vCond}`,
      countParams,
    );

    const readingsInPeriod = await this.readings.query(
      `SELECT COUNT(*)::int AS "count" FROM gps_readings r
       INNER JOIN gps_devices d ON d.id = r."deviceId"
       INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
       WHERE ${tCond} AND r."timestamp" >= $${countParams.length + 1} AND r."timestamp" <= $${countParams.length + 2} ${vCond}`,
      [...countParams, range.start, range.end],
    );

    const vehiclesWithReadings = await this.readings.query(
      `SELECT COUNT(DISTINCT v.id)::int AS "count" FROM gps_readings r
       INNER JOIN gps_devices d ON d.id = r."deviceId"
       INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
       WHERE ${tCond} AND r."timestamp" >= $${countParams.length + 1} AND r."timestamp" <= $${countParams.length + 2} ${vCond}`,
      [...countParams, range.start, range.end],
    );

    const fleetUtilization = (totalVehicles[0]?.count ?? 0) > 0
      ? Math.round(((vehiclesWithReadings[0]?.count ?? 0) / (totalVehicles[0]?.count ?? 1)) * 10000) / 100
      : 0;

    const distanceResult = await this.readings.query(
      `SELECT SUM(r."odometerKm") AS "total" FROM gps_readings r
       INNER JOIN gps_devices d ON d.id = r."deviceId"
       INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
       WHERE ${tCond} AND r."timestamp" >= $${countParams.length + 1} AND r."timestamp" <= $${countParams.length + 2} ${vCond}`,
      [...countParams, range.start, range.end],
    );

    const avgSpeedResult = await this.readings.query(
      `SELECT AVG(r.speed) AS "avg" FROM gps_readings r
       INNER JOIN gps_devices d ON d.id = r."deviceId"
       INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
       WHERE ${tCond} AND r."timestamp" >= $${countParams.length + 1} AND r."timestamp" <= $${countParams.length + 2}
       AND r.speed IS NOT NULL ${vCond}`,
      [...countParams, range.start, range.end],
    );

    const totalEvents = await this.events.query(
      `SELECT COUNT(*)::int AS "count" FROM events e
       INNER JOIN gps_devices d ON d.id = e."deviceId"
       INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
       WHERE ${tCond} AND e."startedAt" >= $${countParams.length + 1} AND e."startedAt" <= $${countParams.length + 2} ${vCond}`,
      [...countParams, range.start, range.end],
    );

    const periodDays = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)));
    const expectedReadings = (activeDeviceCount[0]?.count ?? 0) * periodDays * 24 * 4;
    const dataQualityScore = expectedReadings > 0
      ? Math.round(((readingsInPeriod[0]?.count ?? 0) / expectedReadings) * 10000) / 100
      : 100;

    return {
      totalVehicles: totalVehicles[0]?.count ?? 0,
      activeVehicles: activeVehicles[0]?.count ?? 0,
      maintenanceVehicles: maintenanceVehicles[0]?.count ?? 0,
      fleetUtilization,
      totalDistanceKm: Number(distanceResult[0]?.total ?? 0) || 0,
      avgSpeed: Number(avgSpeedResult[0]?.avg ?? 0) || 0,
      totalEvents: totalEvents[0]?.count ?? 0,
      dataQualityScore: Math.min(100, dataQualityScore),
    };
  }

  async getEventHeatmap(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;

    const joinParts: string[] = [];
    const whereParts: string[] = [this.tenantCondSql(user, 'e')];
    const params: any[] = [];
    if (hasTenant) params.push(user.tenantId);

    if (hasVehicle) {
      joinParts.push('INNER JOIN gps_devices d ON d.id = e."deviceId"');
      joinParts.push('INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL AND v."deletedAt" IS NULL');
      whereParts.push(`AND v.id = $${params.length + 1}`);
      params.push(vehicleId);
    }

    params.push(range.start, range.end);
    const tsStart = `$${params.length - 1}`;
    const tsEnd = `$${params.length}`;

    const sql = `
      SELECT
        EXTRACT(HOUR FROM e."startedAt")::int AS "hour",
        EXTRACT(DOW FROM e."startedAt")::int AS "dayOfWeek",
        COUNT(*)::int AS "count"
      FROM events e
      ${joinParts.join(' ')}
      WHERE ${whereParts.join(' AND ')}
        AND e."startedAt" >= ${tsStart}
        AND e."startedAt" <= ${tsEnd}
      GROUP BY "hour", "dayOfWeek"
    `;

    const rows = await this.events.query(sql, params);
    return rows.map((r: any) => ({
      hour: Number(r.hour),
      dayOfWeek: Number(r.dayOfWeek),
      count: Number(r.count),
    }));
  }

  async getSpeedAnalysis(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;
    const tCond = this.tenantCondSql(user, 'v');
    const vCond = this.vehicleFilterSql(hasVehicle, hasTenant ? 2 : 1);

    const baseParams: any[] = [];
    if (hasTenant) baseParams.push(user.tenantId);
    if (hasVehicle) baseParams.push(vehicleId);
    baseParams.push(range.start, range.end);
    const tsStart = `$${baseParams.length - 1}`;
    const tsEnd = `$${baseParams.length}`;

    const distribution = await this.readings.query(`
      SELECT
        CASE
          WHEN r.speed < 20 THEN '0-20'
          WHEN r.speed < 40 THEN '20-40'
          WHEN r.speed < 60 THEN '40-60'
          WHEN r.speed < 80 THEN '60-80'
          WHEN r.speed < 100 THEN '80-100'
          ELSE '100+'
        END AS "range",
        COUNT(*)::int AS "count"
      FROM gps_readings r
      INNER JOIN gps_devices d ON d.id = r."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond} AND r."timestamp" >= ${tsStart} AND r."timestamp" <= ${tsEnd}
      AND r.speed IS NOT NULL ${vCond}
      GROUP BY "range"
      ORDER BY MIN(r.speed)
    `, baseParams);

    const topViolations = await this.readings.query(`
      SELECT
        v."plateNumber" AS "vehiclePlate",
        v.make AS "vehicleMake",
        v.model AS "vehicleModel",
        r.speed::float AS "speed",
        r."timestamp"::text AS "timestamp",
        r.latitude::float AS "latitude",
        r.longitude::float AS "longitude"
      FROM gps_readings r
      INNER JOIN gps_devices d ON d.id = r."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond} AND r."timestamp" >= ${tsStart} AND r."timestamp" <= ${tsEnd}
      AND r.speed IS NOT NULL ${vCond}
      ORDER BY r.speed DESC
      LIMIT 10
    `, baseParams);

    const avgSpeedByVehicle = await this.readings.query(`
      SELECT
        v.id AS "vehicleId",
        v."plateNumber" AS "plateNumber",
        ROUND(AVG(r.speed)::numeric, 2)::float AS "avgSpeed"
      FROM gps_readings r
      INNER JOIN gps_devices d ON d.id = r."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond} AND r."timestamp" >= ${tsStart} AND r."timestamp" <= ${tsEnd}
      AND r.speed IS NOT NULL ${vCond}
      GROUP BY v.id, v."plateNumber"
      ORDER BY "avgSpeed" DESC
    `, baseParams);

    return {
      distribution: distribution.map((r: any) => ({
        range: r.range,
        count: Number(r.count),
      })),
      topViolations: topViolations.map((r: any) => ({
        vehiclePlate: r.vehiclePlate,
        vehicleMake: r.vehicleMake,
        vehicleModel: r.vehicleModel,
        speed: Number(r.speed),
        timestamp: r.timestamp,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
      })),
      avgSpeedByVehicle: avgSpeedByVehicle.map((r: any) => ({
        vehicleId: r.vehicleId,
        plateNumber: r.plateNumber,
        avgSpeed: Number(r.avgSpeed),
      })),
    };
  }

  async getStoppageIntel(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;
    const tCond = this.tenantCondSql(user, 'v');
    const vCond = this.vehicleFilterSql(hasVehicle, hasTenant ? 2 : 1);

    const baseParams: any[] = [];
    if (hasTenant) baseParams.push(user.tenantId);
    if (hasVehicle) baseParams.push(vehicleId);
    baseParams.push(range.start, range.end);
    const tsStart = `$${baseParams.length - 1}`;
    const tsEnd = `$${baseParams.length}`;

    const timeStats = await this.readings.query(`
      WITH ordered AS (
        SELECT
          r.speed,
          r."timestamp",
          LAG(r."timestamp") OVER (PARTITION BY r."deviceId" ORDER BY r."timestamp") AS prev_ts
        FROM gps_readings r
        INNER JOIN gps_devices d ON d.id = r."deviceId"
        INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
        WHERE ${tCond} AND r."timestamp" >= ${tsStart} AND r."timestamp" <= ${tsEnd} ${vCond}
      )
      SELECT
        ROUND(SUM(CASE WHEN speed > 5 AND prev_ts IS NOT NULL
          THEN EXTRACT(EPOCH FROM ("timestamp" - prev_ts)) / 60.0
          ELSE 0 END)::numeric, 2)::float AS "totalDrivingMinutes",
        ROUND(SUM(CASE WHEN speed <= 5 AND prev_ts IS NOT NULL
          THEN EXTRACT(EPOCH FROM ("timestamp" - prev_ts)) / 60.0
          ELSE 0 END)::numeric, 2)::float AS "totalIdleMinutes"
      FROM ordered
    `, baseParams);

    const totalDrivingMinutes = Number(timeStats[0]?.totalDrivingMinutes ?? 0);
    const totalIdleMinutes = Number(timeStats[0]?.totalIdleMinutes ?? 0);
    const totalMinutes = totalDrivingMinutes + totalIdleMinutes;

    const topStoppages = await this.readings.query(`
      WITH ordered AS (
        SELECT
          r.speed,
          r."timestamp",
          r.latitude,
          r.longitude,
          r."deviceId",
          LAG(r."timestamp") OVER (PARTITION BY r."deviceId" ORDER BY r."timestamp") AS prev_ts
        FROM gps_readings r
        INNER JOIN gps_devices d ON d.id = r."deviceId"
        INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
        WHERE ${tCond} AND r."timestamp" >= ${tsStart} AND r."timestamp" <= ${tsEnd} ${vCond}
      ),
      stoppage_groups AS (
        SELECT *,
          CASE WHEN speed <= 5 AND prev_ts IS NOT NULL
            THEN EXTRACT(EPOCH FROM ("timestamp" - prev_ts)) / 60.0
            ELSE 0 END AS idle_minutes,
          SUM(CASE WHEN speed > 5 OR prev_ts IS NULL THEN 1 ELSE 0 END)
            OVER (ORDER BY "timestamp") AS grp
        FROM ordered
      )
      SELECT
        v."plateNumber" AS "vehiclePlate",
        (ARRAY_AGG(sg.latitude ORDER BY sg."timestamp" ASC))[1]::float AS "latitude",
        (ARRAY_AGG(sg.longitude ORDER BY sg."timestamp" ASC))[1]::float AS "longitude",
        ROUND(SUM(sg.idle_minutes)::numeric, 2)::float AS "durationMinutes",
        MIN(sg."timestamp")::text AS "startTime",
        MAX(sg."timestamp")::text AS "endTime"
      FROM stoppage_groups sg
      INNER JOIN gps_devices d ON d.id = sg."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE sg.grp IN (
        SELECT grp FROM stoppage_groups WHERE idle_minutes > 0 GROUP BY grp HAVING SUM(idle_minutes) > 5
      )
      AND sg.idle_minutes > 0
      GROUP BY v."plateNumber", sg.grp
      ORDER BY "durationMinutes" DESC
      LIMIT 10
    `, baseParams);

    const idleByHour = await this.readings.query(`
      WITH ordered AS (
        SELECT
          r.speed,
          r."timestamp",
          LAG(r."timestamp") OVER (PARTITION BY r."deviceId" ORDER BY r."timestamp") AS prev_ts
        FROM gps_readings r
        INNER JOIN gps_devices d ON d.id = r."deviceId"
        INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
        WHERE ${tCond} AND r."timestamp" >= ${tsStart} AND r."timestamp" <= ${tsEnd} ${vCond}
      )
      SELECT
        EXTRACT(HOUR FROM "timestamp")::int AS "hour",
        ROUND(SUM(CASE WHEN speed <= 5 AND prev_ts IS NOT NULL
          THEN EXTRACT(EPOCH FROM ("timestamp" - prev_ts)) / 60.0
          ELSE 0 END)::numeric, 2)::float AS "totalMinutes"
      FROM ordered
      GROUP BY "hour"
      ORDER BY "hour"
    `, baseParams);

    return {
      totalIdleMinutes,
      totalDrivingMinutes,
      idlePercentage: totalMinutes > 0
        ? Math.round((totalIdleMinutes / totalMinutes) * 10000) / 100
        : 0,
      topStoppages: topStoppages.map((r: any) => ({
        vehiclePlate: r.vehiclePlate,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        durationMinutes: Number(r.durationMinutes),
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      idleByHour: idleByHour.map((r: any) => ({
        hour: Number(r.hour),
        totalMinutes: Number(r.totalMinutes),
      })),
    };
  }

  async getGeofenceViolations(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;
    const tCond = this.tenantCondSql(user, 'v');
    const vCond = this.vehicleFilterSql(hasVehicle, hasTenant ? 2 : 1);

    const baseParams: any[] = [];
    if (hasTenant) baseParams.push(user.tenantId);
    if (hasVehicle) baseParams.push(vehicleId);
    baseParams.push(range.start, range.end);
    const tsStart = `$${baseParams.length - 1}`;
    const tsEnd = `$${baseParams.length}`;

    const zoneStats = await this.events.query(`
      SELECT
        e.metadata->>'geofenceId' AS "geofenceId",
        gf.name AS "geofenceName",
        SUM(CASE WHEN e."eventType" = 'GEOFENCE_IN' THEN 1 ELSE 0 END)::int AS "entryCount",
        SUM(CASE WHEN e."eventType" = 'GEOFENCE_OUT' THEN 1 ELSE 0 END)::int AS "exitCount"
      FROM events e
      INNER JOIN gps_devices d ON d.id = e."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      LEFT JOIN geofences gf ON gf.id = e.metadata->>'geofenceId'
      WHERE ${tCond}
        AND e."eventType" IN ('GEOFENCE_IN', 'GEOFENCE_OUT')
        AND e."startedAt" >= ${tsStart}
        AND e."startedAt" <= ${tsEnd}
        ${vCond}
      GROUP BY e.metadata->>'geofenceId', gf.name
      ORDER BY "exitCount" DESC
    `, baseParams);

    const zoneIds = zoneStats.map((r: any) => r.geofenceId).filter(Boolean);
    const avgDwellMap = new Map<string, number>();

    if (zoneIds.length > 0) {
      const dwellResults = await this.events.query(`
        SELECT
          e.metadata->>'geofenceId' AS "geofenceId",
          AVG(EXTRACT(EPOCH FROM (e."endedAt" - e."startedAt")) / 60.0) AS "avgDwell"
        FROM events e
        WHERE e."eventType" = 'GEOFENCE_IN'
          AND e."endedAt" IS NOT NULL
          AND e.metadata->>'geofenceId' = ANY($1)
          AND e."startedAt" >= $2
          AND e."startedAt" <= $3
        GROUP BY e.metadata->>'geofenceId'
      `, [zoneIds, range.start, range.end]);

      for (const row of dwellResults) {
        avgDwellMap.set(row.geofenceId, Number(row.avgDwell) || 0);
      }
    }

    const violationsByVehicle = await this.events.query(`
      SELECT
        v."plateNumber" AS "vehiclePlate",
        COUNT(*)::int AS "exitCount"
      FROM events e
      INNER JOIN gps_devices d ON d.id = e."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond}
        AND e."eventType" = 'GEOFENCE_OUT'
        AND e."startedAt" >= ${tsStart}
        AND e."startedAt" <= ${tsEnd}
        ${vCond}
      GROUP BY v."plateNumber"
      ORDER BY "exitCount" DESC
    `, baseParams);

    return {
      zoneStats: zoneStats.map((r: any) => ({
        geofenceId: r.geofenceId ?? '',
        geofenceName: r.geofenceName ?? 'Unknown',
        entryCount: Number(r.entryCount),
        exitCount: Number(r.exitCount),
        avgDwellMinutes: Math.round((avgDwellMap.get(r.geofenceId) ?? 0) * 100) / 100,
      })),
      violationsByVehicle: violationsByVehicle.map((r: any) => ({
        vehiclePlate: r.vehiclePlate,
        exitCount: Number(r.exitCount),
      })),
    };
  }

  async getDriverScores(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;
    const tCond = this.tenantCondSql(user, 'd');
    const vCond = this.vehicleFilterSql(hasVehicle, hasTenant ? 2 : 1);

    const baseParams: any[] = [];
    if (hasTenant) baseParams.push(user.tenantId);
    if (hasVehicle) baseParams.push(vehicleId);
    baseParams.push(range.start, range.end);
    const tsStart = `$${baseParams.length - 1}`;
    const tsEnd = `$${baseParams.length}`;

    const results = await this.drivers.query(`
      WITH driver_events AS (
        SELECT
          dr.id AS "driverId",
          dr."firstName",
          dr."lastName",
          e."eventType"
        FROM drivers dr
        INNER JOIN vehicles v ON v.id = dr."vehicleId" AND v."deletedAt" IS NULL
        INNER JOIN gps_devices dev ON dev."vehicleId" = v.id
        INNER JOIN events e ON e."deviceId" = dev.id
        WHERE ${tCond}
          AND e."startedAt" >= ${tsStart}
          AND e."startedAt" <= ${tsEnd}
          ${vCond}
      )
      SELECT
        "driverId",
        "firstName",
        "lastName",
        SUM(CASE WHEN "eventType" = 'OVERSPEED' THEN 1 ELSE 0 END)::int AS "overspeedCount",
        SUM(CASE WHEN "eventType" = 'HARSH_BRAKING' THEN 1 ELSE 0 END)::int AS "harshBrakingCount",
        SUM(CASE WHEN "eventType" = 'HARSH_ACCELERATION' THEN 1 ELSE 0 END)::int AS "harshAccelerationCount",
        SUM(CASE WHEN "eventType" = 'SOS' THEN 1 ELSE 0 END)::int AS "sosCount"
      FROM driver_events
      GROUP BY "driverId", "firstName", "lastName"
    `, baseParams);

    return results.map((r: any) => {
      const overspeedCount = Number(r.overspeedCount);
      const harshBrakingCount = Number(r.harshBrakingCount);
      const harshAccelerationCount = Number(r.harshAccelerationCount);
      const sosCount = Number(r.sosCount);
      const score = Math.max(0, 100 - (overspeedCount * 5 + harshBrakingCount * 3 + harshAccelerationCount * 3 + sosCount * 10));

      return {
        driverId: r.driverId,
        firstName: r.firstName,
        lastName: r.lastName,
        score,
        overspeedCount,
        harshBrakingCount,
        harshAccelerationCount,
        sosCount,
      };
    });
  }

  async getDeviceHealth(
    user: AuthenticatedUser,
    from?: Date,
    to?: Date,
    vehicleId?: string,
  ) {
    const range = this.defaultRange(from, to);
    const hasTenant = !user.isSuperUser && !!user.tenantId;
    const hasVehicle = !!vehicleId;
    const tCond = this.tenantCondSql(user, 'v');
    const vCond = this.vehicleFilterSql(hasVehicle, hasTenant ? 2 : 1);

    const baseParams: any[] = [];
    if (hasTenant) baseParams.push(user.tenantId);
    if (hasVehicle) baseParams.push(vehicleId);
    baseParams.push(range.start, range.end);
    const tsStart = `$${baseParams.length - 1}`;
    const tsEnd = `$${baseParams.length}`;

    const offlineParams: any[] = [];
    if (hasTenant) offlineParams.push(user.tenantId);
    if (hasVehicle) offlineParams.push(vehicleId);
    offlineParams.push(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const offlineTsStart = `$${offlineParams.length}`;

    const offlineCount = await this.devices.query(`
      SELECT COUNT(DISTINCT d.id)::int AS "count"
      FROM gps_devices d
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond} ${vCond}
        AND NOT EXISTS (
          SELECT 1 FROM gps_readings r
          WHERE r."deviceId" = d.id
            AND r."timestamp" >= ${offlineTsStart}
        )
    `, offlineParams);

    const lowBatteryCount = await this.readings.query(`
      SELECT COUNT(DISTINCT r."deviceId")::int AS "count"
      FROM gps_readings r
      INNER JOIN gps_devices d ON d.id = r."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond}
        AND r."timestamp" >= ${tsStart}
        AND r."timestamp" <= ${tsEnd}
        AND r."batteryV" IS NOT NULL
        AND r."batteryV" < 3.5
        ${vCond}
    `, baseParams);

    const avgSignalResult = await this.readings.query(`
      SELECT ROUND(AVG(r."gsmSignal")::numeric, 2)::float AS "avgSignal"
      FROM gps_readings r
      INNER JOIN gps_devices d ON d.id = r."deviceId"
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      WHERE ${tCond}
        AND r."timestamp" >= ${tsStart}
        AND r."timestamp" <= ${tsEnd}
        AND r."gsmSignal" IS NOT NULL
        ${vCond}
    `, baseParams);

    const deviceDetails = await this.readings.query(`
      SELECT
        d.id AS "deviceId",
        d.imei,
        v."plateNumber" AS "vehiclePlate",
        latest."lastSeen",
        latest."batteryV",
        latest."gsmSignal"
      FROM gps_devices d
      INNER JOIN vehicles v ON v.id = d."vehicleId" AND v."deletedAt" IS NULL
      LEFT JOIN LATERAL (
        SELECT
          r."timestamp"::text AS "lastSeen",
          r."batteryV",
          r."gsmSignal"
        FROM gps_readings r
        WHERE r."deviceId" = d.id
          AND r."timestamp" >= ${tsStart}
          AND r."timestamp" <= ${tsEnd}
        ORDER BY r."timestamp" DESC
        LIMIT 1
      ) latest ON true
      WHERE ${tCond} ${vCond}
      ORDER BY latest."lastSeen" DESC NULLS LAST
    `, baseParams);

    return {
      offlineCount: Number(offlineCount[0]?.count ?? 0),
      lowBatteryCount: Number(lowBatteryCount[0]?.count ?? 0),
      avgSignalStrength: Number(avgSignalResult[0]?.avgSignal ?? 0),
      deviceDetails: deviceDetails.map((r: any) => ({
        deviceId: r.deviceId,
        imei: r.imei,
        vehiclePlate: r.vehiclePlate,
        lastSeen: r.lastSeen ?? null,
        batteryV: r.batteryV != null ? Number(r.batteryV) : null,
        gsmSignal: r.gsmSignal != null ? Number(r.gsmSignal) : null,
      })),
    };
  }
}
