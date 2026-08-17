import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { TenantSubscription } from './tenant-subscription.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { Tenant } from '../tenants/tenant.entity';
import { CreateTenantSubscriptionDto, ChangePlanDto, ExtendSubscriptionDto, CancelSubscriptionDto } from './dto/tenant-subscription.dto';

@Injectable()
export class TenantSubscriptionService {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subs: Repository<TenantSubscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly plans: Repository<SubscriptionPlan>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
  ) {}

  async findAll(tenantId?: string) {
    const qb = this.subs.createQueryBuilder('s')
      .leftJoinAndSelect('s.plan', 'plan')
      .leftJoinAndSelect('s.tenant', 'tenant');
    if (tenantId) qb.andWhere('s.tenantId = :tenantId', { tenantId });
    return qb.orderBy('s.createdAt', 'DESC').getMany();
  }

  async findOne(id: string) {
    const sub = await this.subs.findOne({ where: { id }, relations: { plan: true, tenant: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async findByTenantId(tenantId: string) {
    return this.subs.findOne({ where: { tenantId }, relations: { plan: true } });
  }

  async create(dto: CreateTenantSubscriptionDto) {
    const existing = await this.subs.findOne({ where: { tenantId: dto.tenantId } });
    if (existing) throw new ConflictException('Tenant already has a subscription');

    const plan = await this.plans.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date(startDate.getTime() + plan.durationDays * 86400000);

    const sub = this.subs.create({
      tenantId: dto.tenantId,
      planId: dto.planId,
      status: 'active',
      startDate,
      endDate,
      activatedAt: new Date(),
    });
    return this.subs.save(sub);
  }

  async changePlan(id: string, dto: ChangePlanDto) {
    const sub = await this.findOne(id);
    const plan = await this.plans.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    sub.planId = dto.planId;
    if (dto.endDate) {
      sub.endDate = new Date(dto.endDate);
    } else {
      sub.endDate = new Date(sub.startDate.getTime() + plan.durationDays * 86400000);
    }
    return this.subs.save(sub);
  }

  async extend(id: string, dto: ExtendSubscriptionDto) {
    const sub = await this.findOne(id);
    sub.endDate = new Date(dto.endDate);
    if (sub.status === 'expired') sub.status = 'active';
    return this.subs.save(sub);
  }

  async suspend(id: string) {
    const sub = await this.findOne(id);
    sub.status = 'suspended';
    return this.subs.save(sub);
  }

  async reactivate(id: string) {
    const sub = await this.findOne(id);
    if (sub.endDate > new Date()) {
      sub.status = 'active';
    }
    return this.subs.save(sub);
  }

  async cancel(id: string, dto: CancelSubscriptionDto) {
    const sub = await this.findOne(id);
    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
    sub.cancelledReason = dto.reason ?? null;
    return this.subs.save(sub);
  }

  async activate(id: string) {
    const sub = await this.findOne(id);
    sub.status = 'active';
    sub.activatedAt = new Date();
    return this.subs.save(sub);
  }

  async checkAndExpire() {
    const now = new Date();
    const expired = await this.subs.find({
      where: { status: 'active', endDate: LessThanOrEqual(now) },
    });
    for (const sub of expired) {
      sub.status = 'expired';
      await this.subs.save(sub);
    }
    return expired.length;
  }

  async getUsage(tenantId: string) {
    const sub = await this.findByTenantId(tenantId);
    if (!sub || !sub.plan) return null;

    const tenant = await this.tenants.findOne({ where: { id: tenantId }, relations: { users: true } });
    return {
      plan: sub.plan,
      subscription: sub,
      users: { current: tenant?.users?.length ?? 0, limit: sub.plan.maxUsers },
    };
  }
}
