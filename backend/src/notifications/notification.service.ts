import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSetting } from './notification-setting.entity';
import { NotificationLog } from './notification-log.entity';
import { EmailService, SmtpConfig } from './email.service';
import { SmsService, SmsConfig } from './sms.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { Event, EventType } from '../events/event.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';

const EVENT_LABELS: Record<EventType, string> = {
  IDLE: 'Idle Alert',
  STOPPAGE: 'Stoppage Alert',
  OVERSPEED: 'Overspeed Alert',
  GEOFENCE_OUT: 'Geofence Exit',
  GEOFENCE_IN: 'Geofence Entry',
  TOW_AWAY: 'Tow Away Alert',
  POWER_CUT: 'Power Cut Alert',
  LOW_BATTERY: 'Low Battery Alert',
  HARSH_BRAKING: 'Harsh Braking',
  HARSH_ACCELERATION: 'Harsh Acceleration',
  SOS: 'SOS Emergency',
  IGNITION_ON: 'Ignition On',
  IGNITION_OFF: 'Ignition Off',
  DEVICE_OFFLINE: 'Device Offline',
};

export interface SaveNotificationSettingsDto {
  emailEnabled?: boolean;
  emailGlobalRecipients?: string[];
  emailEventOverrides?: Record<string, { enabled: boolean; recipients: string[] }>;

  smsEnabled?: boolean;
  smsGlobalRecipients?: string[];
  smsEventOverrides?: Record<string, { enabled: boolean; recipients: string[] }>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationSetting)
    private readonly settingsRepo: Repository<NotificationSetting>,
    @InjectRepository(NotificationLog)
    private readonly logsRepo: Repository<NotificationLog>,
    @InjectRepository(GPSDevice)
    private readonly devicesRepo: Repository<GPSDevice>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly globalSettings: GlobalSettingsService,
  ) {}

  // ─── SETTINGS CRUD ─────────────────────────────────────

  async getSettings(tenantId: string): Promise<NotificationSetting | null> {
    return this.settingsRepo.findOne({ where: { tenantId } });
  }

  async saveSettings(
    tenantId: string,
    dto: SaveNotificationSettingsDto,
  ): Promise<NotificationSetting> {
    let setting = await this.settingsRepo.findOne({ where: { tenantId } });

    if (!setting) {
      setting = this.settingsRepo.create({ tenantId });
    }

    Object.assign(setting, dto);
    return this.settingsRepo.save(setting);
  }

  // ─── GLOBAL SMTP/SMS CONFIG ──────────────────────────

  async getSmtpConfig(): Promise<SmtpConfig> {
    const password = await this.globalSettings.getValue('smtp.password');
    return {
      host: (await this.globalSettings.getValue('smtp.host')) ?? '',
      port: parseInt((await this.globalSettings.getValue('smtp.port')) ?? '587', 10),
      secure: (await this.globalSettings.getValue('smtp.secure')) === 'true',
      username: (await this.globalSettings.getValue('smtp.username')) ?? '',
      password: password ? this.emailService.decrypt(password) : '',
      fromEmail: (await this.globalSettings.getValue('smtp.fromEmail')) ?? '',
      fromName: (await this.globalSettings.getValue('smtp.fromName')) ?? 'MST-VTS',
    };
  }

  async getSmsConfig(): Promise<SmsConfig> {
    const apiKey = await this.globalSettings.getValue('sms.apiKey');
    return {
      apiKey: apiKey ? this.emailService.decrypt(apiKey) : '',
      senderId: (await this.globalSettings.getValue('sms.senderId')) ?? '',
      type: (await this.globalSettings.getValue('sms.type')) ?? 'transactional',
    };
  }

  async saveSmtpConfig(host: string, port: number, secure: boolean, username: string, password: string, fromEmail: string, fromName: string) {
    await this.globalSettings.set('smtp.host', host, 'smtp');
    await this.globalSettings.set('smtp.port', String(port), 'smtp');
    await this.globalSettings.set('smtp.secure', String(secure), 'smtp');
    await this.globalSettings.set('smtp.username', username, 'smtp');
    if (password && password !== '••••••••' && !password.startsWith('•')) {
      await this.globalSettings.set('smtp.password', this.emailService.encrypt(password), 'smtp');
    }
    await this.globalSettings.set('smtp.fromEmail', fromEmail, 'smtp');
    await this.globalSettings.set('smtp.fromName', fromName, 'smtp');
  }

  async saveSmsConfig(apiKey: string, senderId: string, type: string) {
    if (apiKey && apiKey !== '••••••••' && !apiKey.startsWith('•')) {
      await this.globalSettings.set('sms.apiKey', this.emailService.encrypt(apiKey), 'sms');
    }
    await this.globalSettings.set('sms.senderId', senderId, 'sms');
    await this.globalSettings.set('sms.type', type, 'sms');
  }

  // ─── DISPATCH ──────────────────────────────────────────

  private async resolvePlateNumber(event: Event): Promise<string> {
    const meta = event.metadata as Record<string, any> | null;
    if (meta?.vehiclePlate) return meta.vehiclePlate;

    const device = await this.devicesRepo.findOne({
      where: { id: event.deviceId },
      relations: ['vehicle'],
    });
    return device?.vehicle?.plateNumber ?? 'Unknown';
  }

  async notify(event: Event): Promise<void> {
    const setting = await this.getSettings(event.tenantId);
    if (!setting) return;

    const plateNumber = await this.resolvePlateNumber(event);
    const promises: Promise<void>[] = [];

    if (setting.emailEnabled) {
      promises.push(this.sendEmail(setting, event, plateNumber));
    }

    if (setting.smsEnabled) {
      promises.push(this.sendSms(setting, event, plateNumber));
    }

    await Promise.allSettled(promises);
  }

  private async sendEmail(
    setting: NotificationSetting,
    event: Event,
    plateNumber: string,
  ): Promise<void> {
    const eventType = event.eventType as EventType;

    const override = setting.emailEventOverrides[eventType];
    if (override?.enabled === false) return;

    const recipients =
      override?.recipients?.length > 0
        ? override.recipients
        : setting.emailGlobalRecipients;

    if (recipients.length === 0) return;

    const config = await this.getSmtpConfig();
    if (!config.host) return;

    const contact = await this.globalSettings.getContactDetails();
    const physicalAddress = [contact.name, contact.phone, contact.email].filter(Boolean).join(' | ') || 'MST-VTS, Ranaghat, Nadia, West Bengal 741101, India';

    const subject = `MST-VTS Alert: ${EVENT_LABELS[eventType] ?? eventType} - ${plateNumber}`;
    const html = this.buildEmailHtml(event, plateNumber, physicalAddress);

    const log = this.logsRepo.create({
      tenantId: setting.tenantId,
      eventType,
      eventId: event.id,
      channel: 'email',
      recipients,
      subject,
      status: 'sent',
      sentAt: new Date(),
    });

    try {
      await this.emailService.send(recipients, subject, html, config, {
        physicalAddress,
      });
    } catch (err) {
      log.status = 'failed';
      log.errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email notification failed: ${log.errorMessage}`);
    }

    await this.logsRepo.save(log);
  }

  private async sendSms(
    setting: NotificationSetting,
    event: Event,
    plateNumber: string,
  ): Promise<void> {
    const eventType = event.eventType as EventType;

    const override = setting.smsEventOverrides[eventType];
    if (override?.enabled === false) return;

    const recipients =
      override?.recipients?.length > 0
        ? override.recipients
        : setting.smsGlobalRecipients;

    if (recipients.length === 0) return;

    const config = await this.getSmsConfig();
    if (!config.apiKey) return;

    const message = this.buildSmsText(event, plateNumber);

    const log = this.logsRepo.create({
      tenantId: setting.tenantId,
      eventType,
      eventId: event.id,
      channel: 'sms',
      recipients,
      subject: message.substring(0, 100),
      status: 'sent',
      sentAt: new Date(),
    });

    const result = await this.smsService.send(recipients, message, config);
    if (!result.success) {
      log.status = 'failed';
      log.errorMessage = result.error ?? 'Unknown error';
      this.logger.error(`SMS notification failed: ${log.errorMessage}`);
    }

    await this.logsRepo.save(log);
  }

  // ─── TEMPLATES ─────────────────────────────────────────

  private buildEmailHtml(event: Event, plateNumber: string, physicalAddress?: string): string {
    const eventType = event.eventType as EventType;
    const label = EVENT_LABELS[eventType] ?? eventType;
    const time = event.startedAt
      ? new Date(event.startedAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : 'N/A';

    const meta = event.metadata as Record<string, any> | null;
    const vehiclePlate = plateNumber;
    const speedInfo =
      event.speed != null ? `${event.speed} km/h` : 'N/A';
    const location =
      event.latitude != null && event.longitude != null
        ? `${event.latitude}, ${event.longitude}`
        : 'N/A';

    let extraRows = '';
    if (eventType === 'OVERSPEED' && meta?.maxSpeed) {
      extraRows += `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Speed Limit</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${meta.maxSpeed} km/h</td></tr>`;
    }
    if (eventType === 'GEOFENCE_OUT' || eventType === 'GEOFENCE_IN') {
      extraRows += `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Geofence</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${eventType === 'GEOFENCE_IN' ? 'Entered' : 'Exited'}</td></tr>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:${this.getEventColor(eventType)};color:#ffffff;padding:20px 28px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;font-weight:600;">${label}</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">MST-VTS Fleet Monitoring System</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;">Vehicle</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${vehiclePlate}</td></tr>
            <tr><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;">Event</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${label}</td></tr>
            <tr><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;">Time</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${time}</td></tr>
            <tr><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;">Speed</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${speedInfo}</td></tr>
            <tr><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:14px;">Location</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:14px;">${location}</td></tr>
            ${extraRows}
          </table>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated alert from MST-VTS Fleet Monitoring.</p>
        </td></tr>
        <tr><td style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
            ${physicalAddress || 'MST-VTS Fleet Monitoring'}<br>
            <a href="mailto:support@mstechind.com?subject=Unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
            &nbsp;|&nbsp;
            <a href="https://mstechind.com/settings" style="color:#6b7280;text-decoration:underline;">Notification Preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private getEventColor(eventType: EventType): string {
    switch (eventType) {
      case 'OVERSPEED':
      case 'HARSH_BRAKING':
      case 'HARSH_ACCELERATION':
      case 'SOS':
        return '#dc2626';
      case 'TOW_AWAY':
      case 'POWER_CUT':
        return '#ea580c';
      case 'GEOFENCE_OUT':
      case 'LOW_BATTERY':
      case 'DEVICE_OFFLINE':
        return '#ca8a04';
      case 'GEOFENCE_IN':
      case 'IGNITION_ON':
        return '#16a34a';
      default:
        return '#2563eb';
    }
  }

  private buildSmsText(event: Event, plateNumber: string): string {
    const eventType = event.eventType as EventType;
    const label = EVENT_LABELS[eventType] ?? eventType;
    const meta = event.metadata as Record<string, any> | null;
    const plate = plateNumber;
    const speed = event.speed != null ? ` at ${event.speed}km/h` : '';
    const time = event.startedAt
      ? new Date(event.startedAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return `[Fleet Alert] ${label}: ${plate}${speed}. ${time}`.substring(0, 160);
  }

  // ─── TEST ──────────────────────────────────────────────

  async testEmail(tenantId: string, emailAddress: string): Promise<void> {
    const config = await this.getSmtpConfig();
    if (!config.host) throw new NotFoundException('SMTP not configured');

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#2563eb;color:#ffffff;padding:20px 28px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;font-weight:600;">Test Notification</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">MST-VTS Fleet Monitoring System</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#374151;">Email notifications are working correctly!</p>
          <p style="margin:0;font-size:14px;color:#6b7280;">This is a test message from your fleet monitoring system. If you received this email, your SMTP configuration is set up properly.</p>
        </td></tr>
        <tr><td style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
            MST-VTS Fleet Monitoring &mdash; Ranaghat, Nadia, West Bengal 741101, India<br>
            <a href="mailto:support@mstechind.com?subject=Unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
            &nbsp;|&nbsp;
            <a href="https://mstechind.com/settings" style="color:#6b7280;text-decoration:underline;">Notification Preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    await this.emailService.send([emailAddress], 'Test: MST-VTS Email Notification', html, config);

    const log = this.logsRepo.create({
      tenantId,
      eventType: 'IGNITION_ON' as EventType,
      channel: 'email',
      recipients: [emailAddress],
      subject: '[Test] Fleet Notification',
      status: 'sent',
      sentAt: new Date(),
    });
    await this.logsRepo.save(log);
  }

  async testSms(tenantId: string, phone: string): Promise<void> {
    const config = await this.getSmsConfig();
    if (!config.apiKey) throw new NotFoundException('SMS not configured');

    const message = '[Test] Fleet SMS notifications are working!';
    const result = await this.smsService.send([phone], message, config);

    const log = this.logsRepo.create({
      tenantId,
      eventType: 'IGNITION_ON' as EventType,
      channel: 'sms',
      recipients: [phone],
      subject: message.substring(0, 100),
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.success ? null : result.error,
      sentAt: new Date(),
    });
    await this.logsRepo.save(log);

    if (!result.success) {
      throw new NotFoundException(result.error ?? 'SMS send failed');
    }
  }

  // ─── LOGS ──────────────────────────────────────────────

  async getLogs(
    tenantId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: NotificationLog[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const [data, total] = await this.logsRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
