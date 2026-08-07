import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './driver.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ExcelService, ImportError } from '../common/excel/excel.service';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';

const DRIVER_COLUMNS = [
  { header: 'First Name', key: 'firstName', width: 20 },
  { header: 'Last Name', key: 'lastName', width: 20 },
  { header: 'License Number', key: 'licenseNumber', width: 25 },
  { header: 'Phone', key: 'phone', width: 20 },
];

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly auditLog: AuditLogService,
    private readonly excelService: ExcelService,
  ) {}

  async findAll(actor: AuthenticatedUser, tenantId?: string) {
    const qb = this.drivers
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.vehicle', 'vehicle');

    if (actor.isSuperUser) {
      if (tenantId) qb.andWhere('d.tenantId = :tenantId', { tenantId });
    } else {
      if (!actor.tenantId) {
        throw new ForbiddenException('Account has no tenant assigned');
      }
      qb.andWhere('d.tenantId = :tenantId', { tenantId: actor.tenantId });
    }

    return qb.orderBy('d.createdAt', 'DESC').getMany();
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const driver = await this.drivers.findOne({
      where: { id },
      relations: ['vehicle'],
    });
    if (!driver) throw new NotFoundException('Driver not found');
    this.assertCanAccess(actor, driver);
    return driver;
  }

  async create(actor: AuthenticatedUser, dto: CreateDriverDto) {
    const tenantId = actor.isSuperUser ? (actor.tenantId ?? '') : actor.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Cannot create driver without a tenant');
    }

    const existing = await this.drivers.findOne({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existing) {
      throw new ConflictException('License number already exists');
    }

    const driver = this.drivers.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      licenseNumber: dto.licenseNumber,
      phone: dto.phone ?? null,
      vehicleId: dto.vehicleId ?? null,
      tenantId,
    });
    const saved = await this.drivers.save(driver);

    if (dto.vehicleId) {
      const vehicle = await this.vehicles.findOne({
        where: { id: dto.vehicleId },
        select: ['plateNumber'],
      });
      await this.auditLog.log(actor, {
        action: 'assigned',
        entityType: 'vehicle_driver',
        entityId: dto.vehicleId,
        relatedId: saved.id,
        relatedName: `${saved.firstName} ${saved.lastName}`.trim(),
        entityName: vehicle?.plateNumber ?? null,
      });
    }

    return saved;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateDriverDto) {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');
    this.assertCanAccess(actor, driver);

    if (
      dto.licenseNumber !== undefined &&
      dto.licenseNumber !== driver.licenseNumber
    ) {
      const dup = await this.drivers.findOne({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (dup) throw new ConflictException('License number already exists');
    }

    const oldVehicleId = driver.vehicleId;
    const newVehicleId =
      dto.vehicleId !== undefined ? dto.vehicleId : driver.vehicleId;

    Object.assign(driver, {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.licenseNumber !== undefined && {
        licenseNumber: dto.licenseNumber,
      }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
    });
    const saved = await this.drivers.save(driver);

    // Log vehicle assignment changes
    if (dto.vehicleId !== undefined && oldVehicleId !== newVehicleId) {
      const driverName = `${saved.firstName} ${saved.lastName}`.trim();
      if (oldVehicleId) {
        const oldVehicle = await this.vehicles.findOne({
          where: { id: oldVehicleId },
          select: ['plateNumber'],
        });
        await this.auditLog.log(actor, {
          action: 'unassigned',
          entityType: 'vehicle_driver',
          entityId: oldVehicleId,
          relatedId: saved.id,
          relatedName: driverName,
          entityName: oldVehicle?.plateNumber ?? null,
        });
      }
      if (newVehicleId) {
        const newVehicle = await this.vehicles.findOne({
          where: { id: newVehicleId },
          select: ['plateNumber'],
        });
        await this.auditLog.log(actor, {
          action: 'assigned',
          entityType: 'vehicle_driver',
          entityId: newVehicleId,
          relatedId: saved.id,
          relatedName: driverName,
          entityName: newVehicle?.plateNumber ?? null,
        });
      }
    }

    return saved;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');
    this.assertCanAccess(actor, driver);
    await this.drivers.remove(driver);
  }

  async exportExcel(actor: AuthenticatedUser): Promise<Buffer> {
    const drivers = await this.findAll(actor);
    const rows = drivers.map((d) => ({
      firstName: d.firstName,
      lastName: d.lastName,
      licenseNumber: d.licenseNumber,
      phone: d.phone ?? '',
    }));
    return this.excelService.generateExport(DRIVER_COLUMNS, rows, 'Drivers');
  }

  async validateImport(
    actor: AuthenticatedUser,
    rows: Record<string, any>[],
  ): Promise<{ valid: Record<string, any>[]; errors: ImportError[] }> {
    const errors: ImportError[] = [];
    const valid: Record<string, any>[] = [];

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
      const rowNum = i + 2;

      if (!row.firstName || String(row.firstName).trim() === '') {
        errors.push({ row: rowNum, field: 'firstName', message: 'First Name is required' });
      }
      if (!row.lastName || String(row.lastName).trim() === '') {
        errors.push({ row: rowNum, field: 'lastName', message: 'Last Name is required' });
      }
      if (!row.licenseNumber || String(row.licenseNumber).trim() === '') {
        errors.push({ row: rowNum, field: 'licenseNumber', message: 'License Number is required' });
      }

      if (
        row.licenseNumber &&
        String(row.licenseNumber).trim() !== ''
      ) {
        const existing = await this.drivers.findOne({
          where: { licenseNumber: String(row.licenseNumber).trim() },
        });
        if (existing) {
          errors.push({
            row: rowNum,
            field: 'licenseNumber',
            message: 'License Number already exists',
          });
        }
      }

      if (
        !errors.some((e) => e.row === rowNum)
      ) {
        valid.push({
          firstName: String(row.firstName).trim(),
          lastName: String(row.lastName).trim(),
          licenseNumber: String(row.licenseNumber).trim(),
          phone: row.phone ? String(row.phone).trim() : null,
        });
      }
    }

    return { valid, errors };
  }

  async executeImport(
    actor: AuthenticatedUser,
    rows: CreateDriverDto[],
  ): Promise<{ imported: number; errors: string[] }> {
    for (const dto of rows) {
      await this.create(actor, dto);
    }
    return { imported: rows.length, errors: [] };
  }

  async generateSample(): Promise<Buffer> {
    return this.excelService.generateSample(DRIVER_COLUMNS);
  }

  private assertCanAccess(actor: AuthenticatedUser, driver: Driver): void {
    if (actor.isSuperUser) return;
    if (driver.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You do not have access to this driver');
    }
  }
}
