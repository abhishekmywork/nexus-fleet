import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventRule } from './event-rule.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GeofenceModule } from '../geofences/geofence.module';
import { NotificationModule } from '../notifications/notification.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EventService } from './event.service';
import { EventDetectorService } from './event-detector.service';
import { EventController } from './event.controller';
import { DeviceStateService } from './device-state.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, EventRule, GPSDevice]),
    GeofenceModule,
    NotificationModule,
    SettingsModule,
    AuditLogModule,
  ],
  controllers: [EventController],
  providers: [EventService, EventDetectorService, DeviceStateService],
  exports: [EventService, EventDetectorService, DeviceStateService],
})
export class EventModule implements OnModuleInit {
  constructor(private readonly eventService: EventService) {}

  async onModuleInit() {
    await this.eventService.seedRules();
  }
}
