import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './vehicle.entity';
import { ServingArea } from '../serving-areas/serving-area.entity';
import { Driver } from '../drivers/driver.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, ServingArea, Driver, GPSDevice]), AuditLogModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
