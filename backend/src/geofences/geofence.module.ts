import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from './geofence.entity';
import { Tenant } from '../tenants/tenant.entity';
import { GeofenceService } from './geofence.service';
import { GeofenceImportService } from './geofence-import.service';
import { GeofenceController } from './geofence.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Geofence, Tenant])],
  controllers: [GeofenceController],
  providers: [GeofenceService, GeofenceImportService],
  exports: [GeofenceService, GeofenceImportService],
})
export class GeofenceModule {}
