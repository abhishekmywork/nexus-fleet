import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [TypeOrmModule.forFeature([GPSDevice, GPSReading])],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
