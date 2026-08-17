import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantSubscriptionService } from './tenant-subscription.service';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(private readonly subscriptionService: TenantSubscriptionService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiryCheck() {
    this.logger.log('Running subscription expiry check...');
    try {
      const expired = await this.subscriptionService.checkAndExpire();
      if (expired > 0) {
        this.logger.warn(`${expired} subscription(s) expired`);
      } else {
        this.logger.log('No subscriptions to expire');
      }
    } catch (err) {
      this.logger.error('Subscription expiry check failed', err);
    }
  }
}
