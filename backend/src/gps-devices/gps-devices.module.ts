import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GPSDevice } from './gps-device.entity';
import { GPSReading } from './gps-reading.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { GPSDevicesController } from './gps-devices.controller';
import { GPSDevicesService } from './gps-devices.service';

@Module({
  imports: [TypeOrmModule.forFeature([GPSDevice, GPSReading, Vehicle]), AuditLogModule],
  controllers: [GPSDevicesController],
  providers: [GPSDevicesService],
  exports: [GPSDevicesService],
})
export class GPSDevicesModule {}
