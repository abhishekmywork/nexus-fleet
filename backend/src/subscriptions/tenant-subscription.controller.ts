import { Body, Controller, Get, Param, Post, Patch, Delete, Query } from '@nestjs/common';
import { RequireSuperUser } from '../common/decorators/require-super-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TenantSubscriptionService } from './tenant-subscription.service';
import { TenantInvitationService } from './tenant-invitation.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import {
  CreateTenantSubscriptionDto,
  ChangePlanDto,
  ExtendSubscriptionDto,
  CancelSubscriptionDto,
  CreateInvitationDto,
  VerifyInvitationDto,
} from './dto/tenant-subscription.dto';

@Controller('subscriptions')
export class TenantSubscriptionController {
  constructor(
    private readonly subService: TenantSubscriptionService,
    private readonly inviteService: TenantInvitationService,
    private readonly settings: GlobalSettingsService,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {}

  @Get()
  @RequireSuperUser()
  @Permissions('subscriptions:read')
  findAll(@Query('tenantId') tenantId?: string) {
    return this.subService.findAll(tenantId);
  }

  @Get('usage/:tenantId')
  @RequireSuperUser()
  @Permissions('subscriptions:read')
  getUsage(@Param('tenantId') tenantId: string) {
    return this.subService.getUsage(tenantId);
  }

  @Get(':id')
  @RequireSuperUser()
  @Permissions('subscriptions:read')
  findOne(@Param('id') id: string) {
    return this.subService.findOne(id);
  }

  @Post()
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  create(@Body() dto: CreateTenantSubscriptionDto) {
    return this.subService.create(dto);
  }

  @Patch(':id/change-plan')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  changePlan(@Param('id') id: string, @Body() dto: ChangePlanDto) {
    return this.subService.changePlan(id, dto);
  }

  @Patch(':id/extend')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  extend(@Param('id') id: string, @Body() dto: ExtendSubscriptionDto) {
    return this.subService.extend(id, dto);
  }

  @Patch(':id/suspend')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  suspend(@Param('id') id: string) {
    return this.subService.suspend(id);
  }

  @Patch(':id/reactivate')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  reactivate(@Param('id') id: string) {
    return this.subService.reactivate(id);
  }

  @Patch(':id/cancel')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  cancel(@Param('id') id: string, @Body() dto: CancelSubscriptionDto) {
    return this.subService.cancel(id, dto);
  }

  // ─── Invitations ──────────────────────────────────────────

  @Get('invitations/all')
  @RequireSuperUser()
  @Permissions('subscriptions:read')
  listInvitations(@Query('tenantId') tenantId?: string) {
    return this.inviteService.findAll(tenantId);
  }

  @Post('invitations')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  createInvitation(@Body() dto: CreateInvitationDto) {
    return this.inviteService.create(dto.tenantId, dto.email);
  }

  @Post('invitations/resend/:tenantId')
  @RequireSuperUser()
  @Permissions('subscriptions:update')
  resendInvitation(@Param('tenantId') tenantId: string) {
    return this.inviteService.resend(tenantId);
  }

  @Public()
  @Post('verify')
  verify(@Body() dto: VerifyInvitationDto) {
    return this.inviteService.verify(dto.tenantId, dto.code);
  }

  @Public()
  @Get('status/:tenantSlug')
  async getTenantStatus(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.tenants.findOne({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { status: 'not_found' as const, tenant: null, subscription: null, contact: null };
    }

    const sub = await this.subService.findByTenantId(tenant.id);
    const contact = await this.settings.getContactDetails();

    return {
      status: sub?.status ?? 'none' as const,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      subscription: sub
        ? {
            status: sub.status,
            endDate: sub.endDate,
            plan: sub.plan ? { name: sub.plan.name, durationDays: sub.plan.durationDays } : null,
          }
        : null,
      contact,
    };
  }
}
