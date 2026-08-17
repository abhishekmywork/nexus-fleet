import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventType } from './event.entity';
import { EventRule, DEFAULT_EVENT_RULES } from './event-rule.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface EventQueryDto {
  page?: number;
  limit?: number;
  deviceId?: string;
  eventType?: EventType;
  from?: string;
  to?: string;
  acknowledged?: boolean;
}

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(EventRule)
    private readonly eventRules: Repository<EventRule>,
    @InjectRepository(GPSDevice)
    private readonly devices: Repository<GPSDevice>,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(user: AuthenticatedUser, query: EventQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.device', 'device')
      .leftJoinAndSelect('device.vehicle', 'vehicle');

    if (!user.isSuperUser) {
      if (!user.tenantId) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      qb.andWhere('e.tenantId = :tenantId', { tenantId: user.tenantId });
    }

    if (query.deviceId) {
      qb.andWhere('e.deviceId = :deviceId', { deviceId: query.deviceId });
    }
    if (query.eventType) {
      qb.andWhere('e.eventType = :eventType', { eventType: query.eventType });
    }
    if (query.from) {
      qb.andWhere('e.startedAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('e.startedAt <= :to', { to: query.to });
    }
    if (query.acknowledged !== undefined) {
      qb.andWhere('e.acknowledged = :ack', { ack: query.acknowledged });
    }

    const [data, total] = await qb
      .orderBy('e.startedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRules() {
    return this.eventRules.find({ order: { eventType: 'ASC' } });
  }

  async updateRule(
    id: string,
    dto: { enabled?: boolean; thresholds?: Record<string, any> },
    user?: AuthenticatedUser,
  ) {
    const rule = await this.eventRules.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Event rule not found');
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    if (dto.thresholds !== undefined) rule.thresholds = dto.thresholds;
    const saved = await this.eventRules.save(rule);

    if (user) {
      await this.auditLog.log(user, {
        action: 'updated',
        entityType: 'event_rule',
        entityId: saved.id,
        entityName: saved.eventType,
      });
    }

    return saved;
  }

  async acknowledge(id: string, user: AuthenticatedUser) {
    const qb = this.events.createQueryBuilder('e').where('e.id = :id', { id });
    if (!user.isSuperUser && user.tenantId) {
      qb.andWhere('e.tenantId = :tenantId', { tenantId: user.tenantId });
    }
    const event = await qb.getOne();
    if (!event) throw new NotFoundException('Event not found');
    event.acknowledged = true;
    return this.events.save(event);
  }

  async getStats(user: AuthenticatedUser) {
    const qb = this.events.createQueryBuilder('e');
    if (!user.isSuperUser && user.tenantId) {
      qb.andWhere('e.tenantId = :tenantId', { tenantId: user.tenantId });
    }

    const stats = await qb
      .select('e.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.eventType')
      .getRawMany();

    return stats.reduce(
      (acc, row) => {
        acc[row.eventType] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async seedRules() {
    const existing = await this.eventRules.find();
    const existingTypes = new Set(existing.map((r) => r.eventType));

    const toCreate = DEFAULT_EVENT_RULES.filter(
      (r) => !existingTypes.has(r.eventType),
    ).map((r) => this.eventRules.create(r));

    if (toCreate.length) {
      await this.eventRules.save(toCreate);
    }
  }
}
