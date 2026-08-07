import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Vehicle, Driver, GPSDevice, GPSReading])],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
