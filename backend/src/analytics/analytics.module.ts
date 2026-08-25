import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { Event } from '../events/event.entity';
import { Geofence } from '../geofences/geofence.entity';
import { Driver } from '../drivers/driver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, GPSDevice, GPSReading, Event, Geofence, Driver])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
