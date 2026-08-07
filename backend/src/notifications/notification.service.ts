import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSetting } from './notification-setting.entity';
import { NotificationLog } from './notification-log.entity';
import { EmailService, SmtpConfig } from './email.service';
import { SmsService, SmsConfig } from './sms.service';
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
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  emailGlobalRecipients?: string[];
  emailEventOverrides?: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;

  smsEnabled?: boolean;
  smsApiKey?: string;
  smsSenderId?: string;
  smsType?: string;
  smsGlobalRecipients?: string[];
  smsEventOverrides?: Record<
    string,
    { enabled: boolean; recipients: string[] }
  >;
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

    // Only encrypt passwords that are actually changing (not already encrypted from DB)
    if (dto.smtpPassword !== undefined && dto.smtpPassword !== setting.smtpPassword) {
      dto.smtpPassword = this.emailService.encrypt(dto.smtpPassword);
    }
    if (dto.smsApiKey !== undefined && dto.smsApiKey !== setting.smsApiKey) {
      dto.smsApiKey = this.emailService.encrypt(dto.smsApiKey);
    }

    Object.assign(setting, dto);
    return this.settingsRepo.save(setting);
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

    // Check per-type override
    const override = setting.emailEventOverrides[eventType];
    if (override?.enabled === false) return;

    const recipients =
      override?.recipients?.length > 0
        ? override.recipients
        : setting.emailGlobalRecipients;

    if (recipients.length === 0) return;

    const subject = `[Fleet Alert] ${EVENT_LABELS[eventType] ?? eventType}`;
    const html = this.buildEmailHtml(event, setting, plateNumber);

    const config: SmtpConfig = {
      host: setting.smtpHost,
      port: setting.smtpPort,
      secure: setting.smtpSecure,
      username: setting.smtpUsername,
      password: setting.smtpPassword,
      fromEmail: setting.fromEmail,
      fromName: setting.fromName,
    };

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
      await this.emailService.send(recipients, subject, html, config);
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

    const message = this.buildSmsText(event, plateNumber);
    const config: SmsConfig = {
      apiKey: this.emailService.decrypt(setting.smsApiKey),
      senderId: setting.smsSenderId,
      type: setting.smsType,
    };

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

  private buildEmailHtml(event: Event, setting: NotificationSetting, plateNumber: string): string {
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

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:${this.getEventColor(eventType)};color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;font-weight:600;">⚠️ ${label}</h1>
      <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">Fleet Monitoring Alert</p>
    </div>
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Vehicle</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${vehiclePlate}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Event</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${label}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Speed</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${speedInfo}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Time</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${time}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Location</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${location}</td></tr>
        ${extraRows}
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/events" style="display:inline-block;padding:10px 24px;background:#171717;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">View in Dashboard →</a>
      </div>
    </div>
    <div style="padding:12px 24px;background:#fafafa;text-align:center;font-size:12px;color:#999;">
      This is an automated alert from your fleet monitoring system.
    </div>
  </div>
</body>
</html>`;
  }

  private getEventColor(eventType: EventType): string {
    switch (eventType) {
      case 'SOS':
        return '#dc2626';
      case 'OVERSPEED':
      case 'TOW_AWAY':
      case 'POWER_CUT':
      case 'HARSH_BRAKING':
      case 'HARSH_ACCELERATION':
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

  // ─── TEST ──────────────────────────────────────────────

  async testEmail(tenantId: string, emailAddress: string): Promise<void> {
    const setting = await this.getSettings(tenantId);
    if (!setting) throw new NotFoundException('Notification settings not found');

    const config: SmtpConfig = {
      host: setting.smtpHost,
      port: setting.smtpPort,
      secure: setting.smtpSecure,
      username: setting.smtpUsername,
      password: setting.smtpPassword,
      fromEmail: setting.fromEmail,
      fromName: setting.fromName,
    };

    await this.emailService.send(
      [emailAddress],
      '[Test] Fleet Notification System',
      '<h2>✅ Email notifications are working!</h2><p>This is a test message from your fleet monitoring system.</p>',
      config,
    );
  }

  async testSms(tenantId: string, phoneNumber: string): Promise<void> {
    const setting = await this.getSettings(tenantId);
    if (!setting) throw new NotFoundException('Notification settings not found');

    const config: SmsConfig = {
      apiKey: this.emailService.decrypt(setting.smsApiKey),
      senderId: setting.smsSenderId,
      type: setting.smsType,
    };

    await this.smsService.send(
      [phoneNumber],
      '[Test] Fleet SMS notifications are working!',
      config,
    );
  }
}
