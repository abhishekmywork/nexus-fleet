import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GPSDevice } from './gps-device.entity';
import { GPSReading } from './gps-reading.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ExcelService } from '../common/excel/excel.service';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { CreateGPSDeviceDto, UpdateGPSDeviceDto } from './dto/gps-device.dto';

const GPS_DEVICE_COLUMNS = [
  { header: 'IMEI', key: 'imei', width: 25 },
  { header: 'Model', key: 'model', width: 20 },
  { header: 'Serial Number', key: 'serialNumber', width: 25 },
  { header: 'SIM No.', key: 'simNo', width: 20 },
];

@Injectable()
export class GPSDevicesService {
  constructor(
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    @InjectRepository(GPSReading)
    private readonly readings: Repository<GPSReading>,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    private readonly auditLog: AuditLogService,
    private readonly excel: ExcelService,
  ) {}

  async findAll(actor: AuthenticatedUser, tenantId?: string) {
    const qb = this.devices
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
    const device = await this.devices.findOne({
      where: { id },
      relations: ['vehicle'],
    });
    if (!device) throw new NotFoundException('GPS device not found');
    this.assertCanAccess(actor, device);
    return device;
  }

  async create(actor: AuthenticatedUser, dto: CreateGPSDeviceDto) {
    const tenantId = actor.isSuperUser ? (actor.tenantId ?? '') : actor.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Cannot create GPS device without a tenant',
      );
    }

    const existing = await this.devices.findOne({
      where: { imei: dto.imei },
    });
    if (existing) throw new ConflictException('IMEI already exists');

    const device = this.devices.create({
      imei: dto.imei,
      model: dto.model,
      serialNumber: dto.serialNumber ?? null,
      simNo: dto.simNo ?? null,
      vehicleId: dto.vehicleId ?? null,
      tenantId,
    });
    const saved = await this.devices.save(device);

    if (dto.vehicleId) {
      const vehicle = await this.vehicles.findOne({
        where: { id: dto.vehicleId },
        select: ['plateNumber'],
      });
      await this.auditLog.log(actor, {
        action: 'assigned',
        entityType: 'vehicle_gps_device',
        entityId: dto.vehicleId,
        relatedId: saved.id,
        relatedName: saved.imei,
        entityName: vehicle?.plateNumber ?? null,
      });
    }

    return saved;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateGPSDeviceDto) {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException('GPS device not found');
    this.assertCanAccess(actor, device);

    if (dto.imei !== undefined && dto.imei !== device.imei) {
      const dup = await this.devices.findOne({ where: { imei: dto.imei } });
      if (dup) throw new ConflictException('IMEI already exists');
    }

    const oldVehicleId = device.vehicleId;
    const newVehicleId =
      dto.vehicleId !== undefined ? dto.vehicleId : device.vehicleId;

    Object.assign(device, {
      ...(dto.imei !== undefined && { imei: dto.imei }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
      ...(dto.simNo !== undefined && { simNo: dto.simNo }),
      ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
    });
    const saved = await this.devices.save(device);

    // Log vehicle assignment changes
    if (dto.vehicleId !== undefined && oldVehicleId !== newVehicleId) {
      if (oldVehicleId) {
        const oldVehicle = await this.vehicles
          .createQueryBuilder('v')
          .select('v.plateNumber')
          .where('v.id = :id', { id: oldVehicleId })
          .getOne();
        await this.auditLog.log(actor, {
          action: 'unassigned',
          entityType: 'vehicle_gps_device',
          entityId: oldVehicleId,
          relatedId: saved.id,
          relatedName: saved.imei,
          entityName: oldVehicle?.plateNumber ?? null,
        });
      }
      if (newVehicleId) {
        const newVehicle = await this.vehicles
          .createQueryBuilder('v')
          .select('v.plateNumber')
          .where('v.id = :id', { id: newVehicleId })
          .getOne();
        await this.auditLog.log(actor, {
          action: 'assigned',
          entityType: 'vehicle_gps_device',
          entityId: newVehicleId,
          relatedId: saved.id,
          relatedName: saved.imei,
          entityName: newVehicle?.plateNumber ?? null,
        });
      }
    }

    return saved;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException('GPS device not found');
    this.assertCanAccess(actor, device);
    await this.devices.remove(device);
  }

  async getReadings(
    actor: AuthenticatedUser,
    deviceId: string,
    limit = 100,
  ) {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('GPS device not found');
    this.assertCanAccess(actor, device);

    return this.readings.find({
      where: { deviceId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async exportExcel(actor: AuthenticatedUser) {
    const devices = await this.findAll(actor);
    const rows = devices.map((d) => ({
      imei: d.imei,
      model: d.model,
      serialNumber: d.serialNumber ?? '',
      simNo: d.simNo ?? '',
    }));
    return this.excel.generateExport(GPS_DEVICE_COLUMNS, rows, 'GPS Devices');
  }

  async validateImport(actor: AuthenticatedUser, rows: Record<string, any>[]) {
    const tenantId = actor.isSuperUser ? (actor.tenantId ?? '') : actor.tenantId;
    const valid: CreateGPSDeviceDto[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      // Normalize keys: lowercase + strip spaces → camelCase
      const row: Record<string, any> = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = k
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9]+$/, '');
        row[key] = v;
      }
      const rowErrors: string[] = [];

      if (!row.imei || String(row.imei).trim() === '') {
        rowErrors.push('IMEI is required');
      }
      if (!row.model || String(row.model).trim() === '') {
        rowErrors.push('Model is required');
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 2, message: rowErrors.join('; ') });
      } else {
        const existing = await this.devices.findOne({
          where: { imei: String(row.imei).trim() },
        });
        if (existing) {
          errors.push({
            row: i + 2,
            message: `IMEI "${row.imei}" already exists`,
          });
        } else {
          valid.push({
            imei: String(row.imei).trim(),
            model: String(row.model).trim(),
            serialNumber: row.serialNumber
              ? String(row.serialNumber).trim()
              : undefined,
            simNo: row.simNo ? String(row.simNo).trim() : undefined,
          });
        }
      }
    }

    return { valid, errors };
  }

  async executeImport(actor: AuthenticatedUser, rows: CreateGPSDeviceDto[]) {
    for (const dto of rows) {
      await this.create(actor, dto);
    }
    return { imported: rows.length, errors: [] };
  }

  async generateSample() {
    return this.excel.generateSample(GPS_DEVICE_COLUMNS);
  }

  private assertCanAccess(actor: AuthenticatedUser, device: GPSDevice): void {
    if (actor.isSuperUser) return;
    if (device.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You do not have access to this GPS device');
    }
  }
}
