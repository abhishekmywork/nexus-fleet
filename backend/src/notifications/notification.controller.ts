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

  // ─── GLOBAL SMTP CONFIG (super admin) ───────────────

  @Get('smtp')
  @Permissions('notifications:read')
  async getSmtpConfig() {
    const config = await this.notificationService.getSmtpConfig();
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      username: config.username,
      password: config.password ? '••••••••' : '',
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    };
  }

  @Put('smtp')
  @Permissions('notifications:update')
  async saveSmtpConfig(
    @Body() dto: { host: string; port: number; secure: boolean; username: string; password: string; fromEmail: string; fromName: string },
  ) {
    await this.notificationService.saveSmtpConfig(
      dto.host, dto.port, dto.secure, dto.username, dto.password, dto.fromEmail, dto.fromName,
    );
    return { success: true };
  }

  // ─── GLOBAL SMS CONFIG (super admin) ───────────────

  @Get('sms-config')
  @Permissions('notifications:read')
  async getSmsConfig() {
    const config = await this.notificationService.getSmsConfig();
    return {
      apiKey: config.apiKey ? '••••••••' : '',
      senderId: config.senderId,
      type: config.type,
    };
  }

  @Put('sms-config')
  @Permissions('notifications:update')
  async saveSmsConfig(
    @Body() dto: { apiKey: string; senderId: string; type: string },
  ) {
    await this.notificationService.saveSmsConfig(dto.apiKey, dto.senderId, dto.type);
    return { success: true };
  }

  // ─── PER-TENANT NOTIFICATION SETTINGS ─────────────

  @Get('settings')
  @Permissions('notifications:read')
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    const tenantId: string = user.tenantId ?? '';
    if (!tenantId) {
      return {
        id: null,
        tenantId: '',
        emailEnabled: false,
        emailGlobalRecipients: [],
        emailEventOverrides: {},
        smsEnabled: false,
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
      return { message: 'Super admin must select a tenant to configure notification preferences' };
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
