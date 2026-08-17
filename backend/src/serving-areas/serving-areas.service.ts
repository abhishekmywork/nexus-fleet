import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServingArea } from './serving-area.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { CreateServingAreaDto, UpdateServingAreaDto } from './dto/serving-area.dto';
import { ExcelService, ExcelColumn, ImportError } from '../common/excel/excel.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const AREA_COLUMNS: ExcelColumn[] = [
  { header: 'Name', key: 'name', width: 30 },
  { header: 'Description', key: 'description', width: 40 },
];

@Injectable()
export class ServingAreasService {
  constructor(
    @InjectRepository(ServingArea)
    private readonly areas: Repository<ServingArea>,
    private readonly excelService: ExcelService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(actor: AuthenticatedUser, tenantId?: string) {
    const qb = this.areas.createQueryBuilder('a');

    if (actor.isSuperUser) {
      if (tenantId) qb.andWhere('a.tenantId = :tenantId', { tenantId });
    } else {
      if (!actor.tenantId) {
        throw new ForbiddenException('Account has no tenant assigned');
      }
      qb.andWhere('a.tenantId = :tenantId', { tenantId: actor.tenantId });
    }

    return qb.orderBy('a.name', 'ASC').getMany();
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const area = await this.areas.findOne({ where: { id } });
    if (!area) throw new NotFoundException('Serving area not found');
    this.assertCanAccess(actor, area);
    return area;
  }

  async create(actor: AuthenticatedUser, dto: CreateServingAreaDto) {
    const tenantId = actor.isSuperUser ? (actor.tenantId ?? '') : actor.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Cannot create serving area without a tenant',
      );
    }

    const existing = await this.areas.findOne({
      where: { name: dto.name, tenantId },
    });
    if (existing) {
      throw new ConflictException('Serving area name already exists in this tenant');
    }

    const area = this.areas.create({
      name: dto.name,
      description: dto.description ?? null,
      tenantId,
    });
    const saved = await this.areas.save(area);

    await this.auditLog.log(actor, {
      action: 'created',
      entityType: 'serving_area',
      entityId: saved.id,
      entityName: saved.name,
    });

    return saved;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateServingAreaDto) {
    const area = await this.areas.findOne({ where: { id } });
    if (!area) throw new NotFoundException('Serving area not found');
    this.assertCanAccess(actor, area);

    if (dto.name !== undefined && dto.name !== area.name) {
      const dup = await this.areas.findOne({
        where: { name: dto.name, tenantId: area.tenantId },
      });
      if (dup) throw new ConflictException('Serving area name already exists in this tenant');
    }

    Object.assign(area, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
    });
    const saved = await this.areas.save(area);

    await this.auditLog.log(actor, {
      action: 'updated',
      entityType: 'serving_area',
      entityId: saved.id,
      entityName: saved.name,
    });

    return saved;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const area = await this.areas.findOne({ where: { id } });
    if (!area) throw new NotFoundException('Serving area not found');
    this.assertCanAccess(actor, area);

    const areaId = area.id;
    const areaName = area.name;
    await this.areas.remove(area);

    await this.auditLog.log(actor, {
      action: 'deleted',
      entityType: 'serving_area',
      entityId: areaId,
      entityName: areaName,
    });
  }

  async exportExcel(actor: AuthenticatedUser): Promise<Buffer> {
    const allAreas = await this.findAll(actor);
    const rows = allAreas.map((a) => ({
      name: a.name,
      description: a.description ?? '',
    }));
    return this.excelService.generateExport(AREA_COLUMNS, rows, 'Serving Areas');
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

      if (!row.name || String(row.name).trim() === '') {
        errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
        continue;
      }

      valid.push({
        name: String(row.name).trim(),
        description: row.description ? String(row.description).trim() : null,
      });
    }

    return { valid, errors };
  }

  async executeImport(
    actor: AuthenticatedUser,
    rows: CreateServingAreaDto[],
  ): Promise<{ imported: number; errors: string[] }> {
    for (const dto of rows) {
      await this.create(actor, dto);
    }
    return { imported: rows.length, errors: [] };
  }

  async generateSample(): Promise<Buffer> {
    return this.excelService.generateSample(AREA_COLUMNS);
  }

  private assertCanAccess(actor: AuthenticatedUser, area: ServingArea): void {
    if (actor.isSuperUser) return;
    if (area.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You do not have access to this serving area');
    }
  }
}
