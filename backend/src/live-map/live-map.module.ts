import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GPSDevice } from '../gps-devices/gps-device.entity';
import { GPSReading } from '../gps-devices/gps-reading.entity';
import { Tenant } from '../tenants/tenant.entity';
import { LiveMapGateway } from './live-map.gateway';
import { LiveMapService } from './live-map.service';
import { LiveMapController } from './live-map.controller';
import type { AppConfig } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, GPSDevice, GPSReading, Tenant]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt.accessSecret', { infer: true }),
        signOptions: { expiresIn: '1s' },
      }),
    }),
  ],
  controllers: [LiveMapController],
  providers: [LiveMapGateway, LiveMapService],
  exports: [LiveMapGateway],
})
export class LiveMapModule {}
