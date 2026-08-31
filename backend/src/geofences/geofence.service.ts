import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from './geofence.entity';
import { Tenant } from '../tenants/tenant.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import {
  GeofenceImportService,
  ParsedGeofence,
} from './geofence-import.service';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface CreateGeofenceDto {
  name: string;
  type: 'circle' | 'polygon';
  coordinates: Record<string, any>;
  enabled?: boolean;
}

@Injectable()
export class GeofenceService {
  constructor(
    @InjectRepository(Geofence)
    private readonly geofences: Repository<Geofence>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    private readonly importService: GeofenceImportService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    const qb = this.geofences.createQueryBuilder('g');
    if (!user.isSuperUser && user.tenantId) {
      qb.andWhere('g.tenantId = :tenantId', { tenantId: user.tenantId });
    }
    return qb.orderBy('g.name', 'ASC').getMany();
  }

  async findPublicBySlug(slug: string) {
    const tenant = await this.tenants.findOne({ where: { slug, status: 'active' as const } });
    if (!tenant) return [];
    return this.geofences.find({ where: { tenantId: tenant.id }, order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const g = await this.geofences.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Geofence not found');
    return g;
  }

  async create(user: AuthenticatedUser, dto: CreateGeofenceDto) {
    const tenantId: string = user.tenantId ?? '';
    const geofence = this.geofences.create({
      name: dto.name,
      type: dto.type,
      coordinates: dto.coordinates,
      enabled: dto.enabled ?? true,
      tenantId,
    });
    const saved = await this.geofences.save(geofence);

    await this.auditLog.log(user, {
      action: 'created',
      entityType: 'geofence',
      entityId: saved.id,
      entityName: saved.name,
    });

    return saved;
  }

  async update(id: string, dto: Partial<CreateGeofenceDto>, user?: AuthenticatedUser) {
    const geofence = await this.findOne(id);
    if (dto.name !== undefined) geofence.name = dto.name;
    if (dto.type !== undefined) geofence.type = dto.type;
    if (dto.coordinates !== undefined) geofence.coordinates = dto.coordinates;
    if (dto.enabled !== undefined) geofence.enabled = dto.enabled;
    const saved = await this.geofences.save(geofence);

    if (user) {
      await this.auditLog.log(user, {
        action: 'updated',
        entityType: 'geofence',
        entityId: saved.id,
        entityName: saved.name,
      });
    }

    return saved;
  }

  async remove(id: string, user?: AuthenticatedUser) {
    const geofence = await this.findOne(id);
    const geofenceId = geofence.id;
    const geofenceName = geofence.name;
    await this.geofences.remove(geofence);

    if (user) {
      await this.auditLog.log(user, {
        action: 'deleted',
        entityType: 'geofence',
        entityId: geofenceId,
        entityName: geofenceName,
      });
    }
  }

  async findEnabledForTenant(tenantId: string): Promise<Geofence[]> {
    return this.geofences.find({
      where: { tenantId, enabled: true },
    });
  }

  async importFromBuffer(
    user: AuthenticatedUser,
    buffer: Buffer,
    filename: string,
  ) {
    const result = await this.importService.importFile(buffer, filename);
    const tenantId: string = user.tenantId ?? '';

    const saved: Geofence[] = [];
    for (const parsed of result.imported) {
      const geofence = this.geofences.create({
        name: parsed.name,
        type: parsed.type,
        coordinates: parsed.coordinates,
        enabled: parsed.enabled,
        tenantId,
      });
      saved.push(await this.geofences.save(geofence));
    }

    return {
      imported: saved,
      skipped: result.skipped,
      errors: result.errors,
    };
  }

  /**
   * Test if a point is inside a geofence.
   * Supports circle (haversine distance) and polygon (ray-casting).
   */
  isPointInside(
    lat: number,
    lon: number,
    geofence: Geofence,
  ): boolean {
    const coords = geofence.coordinates;

    if (geofence.type === 'circle') {
      const center = coords.center;
      if (!center) return false;
      const dist = this.haversineDistance(lat, lon, center.lat, center.lon);
      return dist <= (coords.radiusMeters ?? 0);
    }

    if (geofence.type === 'polygon') {
      const points = coords.points;
      if (!Array.isArray(points) || points.length < 3) return false;
      return this.raycasting(lat, lon, points);
    }

    return false;
  }

  /**
   * Calculate shortest distance from a point to the geofence boundary.
   * Negative = inside (distance to nearest edge), positive = outside.
   */
  distanceFromBoundary(lat: number, lon: number, geofence: Geofence): number {
    if (geofence.type === 'circle') {
      return this.distanceFromCircle(lat, lon, geofence);
    }
    if (geofence.type === 'polygon') {
      return this.distanceFromPolygon(lat, lon, geofence);
    }
    return 0;
  }

  private distanceFromCircle(lat: number, lon: number, geofence: Geofence): number {
    const center = geofence.coordinates.center;
    if (!center) return 0;
    const dist = this.haversineDistance(lat, lon, center.lat, center.lon);
    return dist - (geofence.coordinates.radiusMeters ?? 0);
  }

  private distanceFromPolygon(lat: number, lon: number, geofence: Geofence): number {
    const points = geofence.coordinates.points;
    if (!Array.isArray(points) || points.length < 3) return 0;

    const inside = this.raycasting(lat, lon, points);

    let minDist = Infinity;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dist = this.pointToSegmentDistance(
        lat, lon,
        points[i].lat, points[i].lon,
        points[j].lat, points[j].lon,
      );
      if (dist < minDist) minDist = dist;
    }

    return inside ? -minDist : minDist;
  }

  /**
   * Haversine distance from point (px,py) to the closest point on segment (ax,ay)-(bx,by).
   */
  private pointToSegmentDistance(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return this.haversineDistance(px, py, ax, ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projLat = ay + t * dy;
    const projLon = ax + t * dx;
    return this.haversineDistance(px, py, projLat, projLon);
  }

  /**
   * Haversine distance in meters between two lat/lon points.
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Ray-casting algorithm for point-in-polygon test.
   * Points array: [{ lat, lon }, ...]
   */
  private raycasting(
    lat: number,
    lon: number,
    points: { lat: number; lon: number }[],
  ): boolean {
    let inside = false;
    const n = points.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = points[i].lon, yi = points[i].lat;
      const xj = points[j].lon, yj = points[j].lat;
      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
