import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { ServingArea } from '../serving-areas/serving-area.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ExcelService } from '../common/excel/excel.service';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import {
  AssignServingAreasDto,
  CreateVehicleDto,
  UpdateVehicleDto,
} from './dto/vehicle.dto';

const VEHICLE_COLUMNS = [
  { header: 'Plate Number', key: 'plateNumber', width: 20 },
  { header: 'Make', key: 'make', width: 20 },
  { header: 'Model', key: 'model', width: 20 },
  { header: 'Year', key: 'year', width: 10 },
  { header: 'Status', key: 'status', width: 15 },
  { header: 'Notes', key: 'notes', width: 30 },
];

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(ServingArea)
    private readonly areas: Repository<ServingArea>,
    private readonly auditLog: AuditLogService,
    private readonly excelService: ExcelService,
  ) {}

  async findAll(actor: AuthenticatedUser, tenantId?: string) {
    const qb = this.vehicles
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.servingAreas', 'area')
      .leftJoinAndSelect('v.driver', 'driver')
      .leftJoinAndSelect('v.gpsDevice', 'device');

    if (actor.isSuperUser) {
      if (tenantId) qb.andWhere('v.tenantId = :tenantId', { tenantId });
    } else {
      if (!actor.tenantId) {
        throw new ForbiddenException('Account has no tenant assigned');
      }
      qb.andWhere('v.tenantId = :tenantId', { tenantId: actor.tenantId });
    }

    return qb.orderBy('v.createdAt', 'DESC').getMany();
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const vehicle = await this.vehicles.findOne({
      where: { id },
      relations: ['servingAreas', 'driver', 'gpsDevice'],
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    this.assertCanAccess(actor, vehicle);
    return vehicle;
  }

  async create(actor: AuthenticatedUser, dto: CreateVehicleDto) {
    const existing = await this.vehicles.findOne({
      where: { plateNumber: dto.plateNumber },
    });
    if (existing) throw new ConflictException('Plate number already exists');

    const tenantId = actor.isSuperUser ? (actor.tenantId ?? '') : actor.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Cannot create vehicle without a tenant');
    }

    const servingAreas = dto.servingAreaIds?.length
      ? await this.loadAreas(dto.servingAreaIds)
      : [];

    const vehicle = this.vehicles.create({
      plateNumber: dto.plateNumber,
      make: dto.make,
      model: dto.model,
      year: dto.year ?? null,
      status: (dto.status as any) ?? 'active',
      notes: dto.notes ?? null,
      tenantId,
      servingAreas,
    });
    return this.vehicles.save(vehicle);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateVehicleDto) {
    const vehicle = await this.vehicles.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    this.assertCanAccess(actor, vehicle);

    if (dto.plateNumber !== undefined && dto.plateNumber !== vehicle.plateNumber) {
      const dup = await this.vehicles.findOne({
        where: { plateNumber: dto.plateNumber },
      });
      if (dup) throw new ConflictException('Plate number already exists');
    }

    if (dto.servingAreaIds !== undefined) {
      vehicle.servingAreas = dto.servingAreaIds.length
        ? await this.loadAreas(dto.servingAreaIds)
        : [];
    }

    Object.assign(vehicle, {
      ...(dto.plateNumber !== undefined && { plateNumber: dto.plateNumber }),
      ...(dto.make !== undefined && { make: dto.make }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.year !== undefined && { year: dto.year }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    return this.vehicles.save(vehicle);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const vehicle = await this.vehicles.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    this.assertCanAccess(actor, vehicle);
    await this.vehicles.remove(vehicle);
  }

  async assignServingAreas(
    actor: AuthenticatedUser,
    id: string,
    dto: AssignServingAreasDto,
  ) {
    const vehicle = await this.vehicles.findOne({
      where: { id },
      relations: ['servingAreas'],
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    this.assertCanAccess(actor, vehicle);

    const oldIds = new Set(vehicle.servingAreas.map((a) => a.id));
    const newAreas = await this.loadAreas(dto.servingAreaIds);
    const newIds = new Set(newAreas.map((a) => a.id));

    // Log removed areas
    for (const area of vehicle.servingAreas) {
      if (!newIds.has(area.id)) {
        await this.auditLog.log(actor, {
          action: 'unassigned',
          entityType: 'vehicle_serving_area',
          entityId: vehicle.id,
          relatedId: area.id,
          relatedName: area.name,
          entityName: vehicle.plateNumber,
        });
      }
    }

    // Log added areas
    for (const area of newAreas) {
      if (!oldIds.has(area.id)) {
        await this.auditLog.log(actor, {
          action: 'assigned',
          entityType: 'vehicle_serving_area',
          entityId: vehicle.id,
          relatedId: area.id,
          relatedName: area.name,
          entityName: vehicle.plateNumber,
        });
      }
    }

    vehicle.servingAreas = newAreas;
    return this.vehicles.save(vehicle);
  }

  async exportExcel(actor: AuthenticatedUser): Promise<Buffer> {
    const vehicles = await this.findAll(actor);
    const rows = vehicles.map((v) => ({
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      year: v.year ?? '',
      status: v.status,
      notes: v.notes ?? '',
    }));
    return this.excelService.generateExport(VEHICLE_COLUMNS, rows, 'Vehicles');
  }

  async validateImport(
    actor: AuthenticatedUser,
    rows: CreateVehicleDto[],
  ): Promise<{ valid: CreateVehicleDto[]; errors: { row: number; field: string; message: string }[] }> {
    const valid: CreateVehicleDto[] = [];
    const errors: { row: number; field: string; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const row: Record<string, any> = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = k
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9]+$/, '');
        row[key] = v;
      }
      const rowNum = i + 2; // Excel row number (1-indexed header)

      if (!row.plateNumber || !String(row.plateNumber).trim()) {
        errors.push({ row: rowNum, field: 'plateNumber', message: 'Plate Number is required' });
        continue;
      }
      if (!row.make || !String(row.make).trim()) {
        errors.push({ row: rowNum, field: 'make', message: 'Make is required' });
        continue;
      }
      if (!row.model || !String(row.model).trim()) {
        errors.push({ row: rowNum, field: 'model', message: 'Model is required' });
        continue;
      }
      if (row.status && !['active', 'inactive', 'maintenance'].includes(row.status)) {
        errors.push({ row: rowNum, field: 'status', message: 'Status must be active, inactive, or maintenance' });
        continue;
      }

      valid.push({
        plateNumber: String(row.plateNumber).trim(),
        make: String(row.make).trim(),
        model: String(row.model).trim(),
        year: row.year ?? undefined,
        status: row.status ?? 'active',
        notes: row.notes ?? undefined,
      });
    }

    return { valid, errors };
  }

  async executeImport(
    actor: AuthenticatedUser,
    rows: CreateVehicleDto[],
  ): Promise<{ imported: number; errors: string[] }> {
    for (const dto of rows) {
      await this.create(actor, dto);
    }
    return { imported: rows.length, errors: [] };
  }

  async generateSample(): Promise<Buffer> {
    return this.excelService.generateSample(VEHICLE_COLUMNS);
  }

  private async loadAreas(ids: string[]): Promise<ServingArea[]> {
    const areas = await this.areas.find({ where: { id: In(ids) } });
    if (areas.length !== new Set(ids).size) {
      throw new NotFoundException('One or more serving areas were not found');
    }
    return areas;
  }

  private assertCanAccess(actor: AuthenticatedUser, vehicle: Vehicle): void {
    if (actor.isSuperUser) return;
    if (vehicle.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You do not have access to this vehicle');
    }
  }
}
