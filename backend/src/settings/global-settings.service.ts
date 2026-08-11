import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalSetting } from './global-setting.entity';

export const DEFAULT_GLOBAL_SETTINGS = [
  { key: 'global.defaultSpeedLimit', value: '120', category: 'event_defaults', description: 'Default speed limit (km/h)' },
  { key: 'global.idleThresholdMinutes', value: '10', category: 'event_defaults', description: 'Idle alert threshold (minutes)' },
  { key: 'global.stoppageThresholdMinutes', value: '5', category: 'event_defaults', description: 'Stoppage alert threshold (minutes)' },
  { key: 'global.offlineThresholdMinutes', value: '30', category: 'event_defaults', description: 'Device offline threshold (minutes)' },
  { key: 'global.geofenceBufferMeters', value: '50', category: 'event_defaults', description: 'Geofence buffer zone (meters)' },
  { key: 'global.eventCooldownMinutes', value: '5', category: 'event_defaults', description: 'Instant event cooldown (minutes)' },
  { key: 'global.dataRetentionDays', value: '90', category: 'system', description: 'Audit log retention (days, 0 = forever)' },
  { key: 'contact.name', value: 'MST-VTS Support', category: 'contact', description: 'Contact person or department name' },
  { key: 'contact.phone', value: '', category: 'contact', description: 'Contact phone number' },
  { key: 'contact.email', value: '', category: 'contact', description: 'Contact email address' },
  { key: 'smtp.host', value: '', category: 'smtp', description: 'SMTP server host' },
  { key: 'smtp.port', value: '587', category: 'smtp', description: 'SMTP server port' },
  { key: 'smtp.secure', value: 'false', category: 'smtp', description: 'Use TLS (true/false)' },
  { key: 'smtp.username', value: '', category: 'smtp', description: 'SMTP username' },
  { key: 'smtp.password', value: '', category: 'smtp', description: 'SMTP password (encrypted)' },
  { key: 'smtp.fromEmail', value: '', category: 'smtp', description: 'Sender email address' },
  { key: 'smtp.fromName', value: 'MST-VTS', category: 'smtp', description: 'Sender display name' },
  { key: 'sms.apiKey', value: '', category: 'sms', description: 'SMS gateway API key (encrypted)' },
  { key: 'sms.senderId', value: '', category: 'sms', description: 'SMS sender ID' },
  { key: 'sms.type', value: 'transactional', category: 'sms', description: 'SMS type (transactional/promotional)' },
];

@Injectable()
export class GlobalSettingsService {
  private readonly logger = new Logger(GlobalSettingsService.name);

  constructor(
    @InjectRepository(GlobalSetting)
    private readonly repo: Repository<GlobalSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  private async seedDefaults(): Promise<void> {
    const existing = await this.repo.find();
    const existingKeys = new Set(existing.map((s) => s.key));

    const toCreate = DEFAULT_GLOBAL_SETTINGS
      .filter((s) => !existingKeys.has(s.key))
      .map((s) => this.repo.create(s));

    if (toCreate.length) {
      await this.repo.save(toCreate);
      this.logger.log(`Seeded ${toCreate.length} default global settings`);
    }
  }

  async findAll(category?: string): Promise<GlobalSetting[]> {
    const where = category ? { category } : {};
    return this.repo.find({ where, order: { category: 'ASC', key: 'ASC' } });
  }

  async findByKey(key: string): Promise<GlobalSetting | null> {
    return this.repo.findOne({ where: { key } });
  }

  async getValue(key: string): Promise<string | null> {
    const setting = await this.repo.findOne({ where: { key } });
    return setting?.value ?? null;
  }

  async getNumeric(key: string, fallback: number): Promise<number> {
    const val = await this.getValue(key);
    if (val == null || val === '') return fallback;
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  }

  async set(key: string, value: string, category?: string, description?: string): Promise<GlobalSetting> {
    let setting = await this.repo.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      if (category) setting.category = category;
      if (description) setting.description = description;
    } else {
      setting = this.repo.create({ key, value, category: category ?? 'general', description: description ?? '' });
    }
    return this.repo.save(setting);
  }

  async bulkSet(entries: { key: string; value: string; category?: string; description?: string }[]): Promise<GlobalSetting[]> {
    const results: GlobalSetting[] = [];
    for (const entry of entries) {
      results.push(await this.set(entry.key, entry.value, entry.category, entry.description));
    }
    return results;
  }

  async getContactDetails(): Promise<{ name: string; phone: string; email: string }> {
    const name = await this.getValue('contact.name');
    const phone = await this.getValue('contact.phone');
    const email = await this.getValue('contact.email');
    return {
      name: name ?? 'MST-VTS Support',
      phone: phone ?? '',
      email: email ?? '',
    };
  }
}
