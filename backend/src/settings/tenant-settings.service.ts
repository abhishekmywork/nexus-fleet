import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantSetting } from './tenant-setting.entity';
import { GlobalSettingsService } from './global-settings.service';

export interface UpdateTenantSettingsDto {
  defaultSpeedLimit?: number;
  idleThresholdMinutes?: number;
  stoppageThresholdMinutes?: number;
  offlineThresholdMinutes?: number;
  geofenceBufferMeters?: number;
  eventCooldownMinutes?: number;
  timezone?: string;
}

@Injectable()
export class TenantSettingsService {
  private readonly logger = new Logger(TenantSettingsService.name);

  constructor(
    @InjectRepository(TenantSetting)
    private readonly repo: Repository<TenantSetting>,
    private readonly globalSettings: GlobalSettingsService,
  ) {}

  async findByTenant(tenantId: string): Promise<TenantSetting | null> {
    return this.repo.findOne({ where: { tenantId } });
  }

  async getOrCreate(tenantId: string): Promise<TenantSetting> {
    let setting = await this.repo.findOne({ where: { tenantId } });
    if (!setting) {
      // Initialize with global defaults
      const [speedLimit, idle, stoppage, offline, buffer, cooldown] = await Promise.all([
        this.globalSettings.getNumeric('global.defaultSpeedLimit', 120),
        this.globalSettings.getNumeric('global.idleThresholdMinutes', 10),
        this.globalSettings.getNumeric('global.stoppageThresholdMinutes', 5),
        this.globalSettings.getNumeric('global.offlineThresholdMinutes', 30),
        this.globalSettings.getNumeric('global.geofenceBufferMeters', 50),
        this.globalSettings.getNumeric('global.eventCooldownMinutes', 5),
      ]);

      setting = this.repo.create({
        tenantId,
        defaultSpeedLimit: speedLimit,
        idleThresholdMinutes: idle,
        stoppageThresholdMinutes: stoppage,
        offlineThresholdMinutes: offline,
        geofenceBufferMeters: buffer,
        eventCooldownMinutes: cooldown,
      });
      await this.repo.save(setting);
    }
    return setting;
  }

  async update(tenantId: string, dto: UpdateTenantSettingsDto): Promise<TenantSetting> {
    const setting = await this.getOrCreate(tenantId);
    Object.assign(setting, dto);
    return this.repo.save(setting);
  }

  async resolveWithFallback<T extends keyof TenantSetting>(
    tenantId: string,
    field: T,
    fallbackKey: string,
    fallbackDefault: number,
  ): Promise<number> {
    const tenantSetting = await this.findByTenant(tenantId);
    if (tenantSetting && tenantSetting[field] != null) {
      return tenantSetting[field] as unknown as number;
    }
    return this.globalSettings.getNumeric(fallbackKey, fallbackDefault);
  }
}
