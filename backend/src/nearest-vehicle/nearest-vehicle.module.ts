import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NearestVehicleController } from './nearest-vehicle.controller';
import { NearestVehicleService } from './nearest-vehicle.service';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, GPSDevice, GPSReading])],
  controllers: [NearestVehicleController],
  providers: [NearestVehicleService],
})
export class NearestVehicleModule {}
