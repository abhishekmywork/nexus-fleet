import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { EventModule } from '../events/event.module';
import { LiveMapModule } from '../live-map/live-map.module';
import { TelemetryConsumerService } from './telemetry-consumer.service';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { GpsCleanerService } from './gps-cleaner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GPSReading, GPSDevice]),
    EventModule,
    LiveMapModule,
  ],
  controllers: [TelemetryController],
  providers: [TelemetryConsumerService, TelemetryService, GpsCleanerService],
  exports: [TelemetryConsumerService, TelemetryService, GpsCleanerService],
})
export class TelemetryModule {}
