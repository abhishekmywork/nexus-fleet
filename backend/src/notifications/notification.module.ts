import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationSetting } from './notification-setting.entity';
import { NotificationLog } from './notification-log.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationSetting, NotificationLog, GPSDevice]), SettingsModule],
  controllers: [NotificationController],
  providers: [EmailService, SmsService, NotificationService],
  exports: [NotificationService, EmailService],
})
export class NotificationModule {}
