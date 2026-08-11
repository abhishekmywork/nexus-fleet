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
    return this.geofences.save(geofence);
  }

  async update(id: string, dto: Partial<CreateGeofenceDto>) {
    const geofence = await this.findOne(id);
    if (dto.name !== undefined) geofence.name = dto.name;
    if (dto.type !== undefined) geofence.type = dto.type;
    if (dto.coordinates !== undefined) geofence.coordinates = dto.coordinates;
    if (dto.enabled !== undefined) geofence.enabled = dto.enabled;
    return this.geofences.save(geofence);
  }

  async remove(id: string) {
    const geofence = await this.findOne(id);
    await this.geofences.remove(geofence);
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
