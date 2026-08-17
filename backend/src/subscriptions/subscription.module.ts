import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { TenantSubscription } from './tenant-subscription.entity';
import { TenantInvitation } from './tenant-invitation.entity';
import { Tenant } from '../tenants/tenant.entity';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionPlanController } from './subscription-plan.controller';
import { TenantSubscriptionService } from './tenant-subscription.service';
import { TenantSubscriptionController } from './tenant-subscription.controller';
import { TenantInvitationService } from './tenant-invitation.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { SettingsModule } from '../settings/settings.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPlan, TenantSubscription, TenantInvitation, Tenant]),
    SettingsModule,
    NotificationModule,
  ],
  controllers: [SubscriptionPlanController, TenantSubscriptionController],
  providers: [SubscriptionPlanService, TenantSubscriptionService, TenantInvitationService, SubscriptionSchedulerService],
  exports: [SubscriptionPlanService, TenantSubscriptionService, TenantInvitationService],
})
export class SubscriptionModule {}
