import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import {
  NotificationService,
  SaveNotificationSettingsDto,
} from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('settings')
  @Permissions('notifications:read')
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    const tenantId: string = user.tenantId ?? '';
    if (!tenantId) {
      return {
        id: null,
        tenantId: '',
        emailEnabled: false,
        smtpHost: '',
        smtpPort: 587,
        smtpSecure: false,
        smtpUsername: '',
        smtpPassword: '',
        fromEmail: '',
        fromName: '',
        emailGlobalRecipients: [],
        emailEventOverrides: {},
        smsEnabled: false,
        smsApiKey: '',
        smsSenderId: '',
        smsType: 'transactional',
        smsGlobalRecipients: [],
        smsEventOverrides: {},
      };
    }
    return this.notificationService.getSettings(tenantId);
  }

  @Put('settings')
  @Permissions('notifications:update')
  async saveSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveNotificationSettingsDto,
  ) {
    const tenantId: string = user.tenantId ?? '';
    if (!tenantId) {
      return { message: 'Super admin must select a tenant to configure notifications' };
    }
    return this.notificationService.saveSettings(tenantId, dto);
  }

  @Post('test/email')
  @Permissions('notifications:update')
  async testEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body('email') email: string,
  ) {
    const tenantId: string = user.tenantId ?? '';
    await this.notificationService.testEmail(tenantId, email);
    return { success: true };
  }

  @Post('test/sms')
  @Permissions('notifications:update')
  async testSms(
    @CurrentUser() user: AuthenticatedUser,
    @Body('phone') phone: string,
  ) {
    const tenantId: string = user.tenantId ?? '';
    await this.notificationService.testSms(tenantId, phone);
    return { success: true };
  }

  @Get('logs')
  @Permissions('notifications:read')
  async getLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId: string = user.tenantId ?? '';
    if (!tenantId) {
      return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
    return this.notificationService.getLogs(
      tenantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
