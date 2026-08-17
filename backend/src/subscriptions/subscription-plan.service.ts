import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { CreatePlanDto, UpdatePlanDto } from './dto/subscription-plan.dto';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly plans: Repository<SubscriptionPlan>,
  ) {}

  async findAll() {
    return this.plans.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async findActive() {
    return this.plans.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async findOne(id: string) {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  async findBySlug(slug: string) {
    return this.plans.findOne({ where: { slug } });
  }

  async create(dto: CreatePlanDto) {
    const slug = dto.slug || this.slugify(dto.name);
    const existing = await this.plans.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Plan with this name already exists');

    if (dto.isDefault) {
      await this.clearDefault();
    }

    const plan = this.plans.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      durationDays: dto.durationDays,
      maxUsers: dto.maxUsers ?? null,
      maxVehicles: dto.maxVehicles ?? null,
      maxDevices: dto.maxDevices ?? null,
      features: dto.features ?? {},
      isActive: dto.isActive ?? true,
      isDefault: dto.isDefault ?? false,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.plans.save(plan);
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.findOne(id);
    Object.assign(plan, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
      ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
      ...(dto.maxVehicles !== undefined && { maxVehicles: dto.maxVehicles }),
      ...(dto.maxDevices !== undefined && { maxDevices: dto.maxDevices }),
      ...(dto.features !== undefined && { features: dto.features }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });

    if (dto.isDefault) {
      await this.clearDefault();
      plan.isDefault = true;
    } else if (dto.isDefault === false) {
      plan.isDefault = false;
    }

    return this.plans.save(plan);
  }

  async remove(id: string): Promise<void> {
    const plan = await this.findOne(id);
    if (plan.isDefault) throw new ConflictException('Cannot delete the default plan');
    await this.plans.remove(plan);
  }

  async getDefault() {
    return this.plans.findOne({ where: { isDefault: true } });
  }

  private async clearDefault() {
    await this.plans.update({ isDefault: true }, { isDefault: false });
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}
