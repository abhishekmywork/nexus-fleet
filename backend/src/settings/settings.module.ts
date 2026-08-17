import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSetting } from './global-setting.entity';
import { TenantSetting } from './tenant-setting.entity';
import { GlobalSettingsService } from './global-settings.service';
import { TenantSettingsService } from './tenant-settings.service';
import { GlobalSettingsController } from './global-settings.controller';
import { TenantSettingsController } from './tenant-settings.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalSetting, TenantSetting]), AuditLogModule],
  controllers: [GlobalSettingsController, TenantSettingsController],
  providers: [GlobalSettingsService, TenantSettingsService],
  exports: [GlobalSettingsService, TenantSettingsService],
})
export class SettingsModule {}
