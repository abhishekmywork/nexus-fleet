import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AuditLog } from './audit-log.entity';
import { CreateAuditLogDto, AuditLogQueryDto } from './dto/audit-log.dto';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async log(
    actor: AuthenticatedUser,
    dto: CreateAuditLogDto,
  ): Promise<void> {
    const entry = this.logs.create({
      action: dto.action as any,
      entityType: dto.entityType as any,
      entityId: dto.entityId,
      relatedId: dto.relatedId,
      relatedName: dto.relatedName,
      entityName: dto.entityName ?? null,
      actorId: actor.id,
      actorEmail: actor.email,
      tenantId: actor.tenantId ?? '',
    });
    await this.logs.save(entry);
  }

  async findAll(
    actor: AuthenticatedUser,
    query: AuditLogQueryDto,
    limit = 50,
  ) {
    const qb = this.logs.createQueryBuilder('l');

    if (actor.isSuperUser) {
      if (actor.tenantId) {
        qb.andWhere('l.tenantId = :tenantId', { tenantId: actor.tenantId });
      }
    } else {
      if (!actor.tenantId) {
        throw new ForbiddenException('Account has no tenant assigned');
      }
      qb.andWhere('l.tenantId = :tenantId', { tenantId: actor.tenantId });
    }

    if (query.entityType) {
      qb.andWhere('l.entityType = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.entityId) {
      qb.andWhere('l.entityId = :entityId', { entityId: query.entityId });
    }

    return qb.orderBy('l.createdAt', 'DESC').take(limit).getMany();
  }

  async purgeOldLogs(): Promise<number> {
    const retentionDays = this.config.get('auditLogRetentionDays', {
      infer: true,
    });
    if (retentionDays === 0) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.logs.delete({
      createdAt: LessThan(cutoff),
    });
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} audit logs older than ${retentionDays} days`);
    }
    return deleted;
  }
}
