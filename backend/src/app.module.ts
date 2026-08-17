import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration, type AppConfig } from './config/configuration';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { SeedService } from './database/seeds/seed.service';
import { User } from './users/user.entity';
import { Role } from './roles/role.entity';
import { Permission } from './permissions/permission.entity';
import { Tenant } from './tenants/tenant.entity';
import { Vehicle } from './vehicles/vehicle.entity';
import { ServingArea } from './serving-areas/serving-area.entity';
import { Driver } from './drivers/driver.entity';
import { GPSDevice } from './gps-devices/gps-device.entity';
import { GPSReading } from './gps-devices/gps-reading.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { TenantsModule } from './tenants/tenants.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ServingAreasModule } from './serving-areas/serving-areas.module';
import { DriversModule } from './drivers/drivers.module';
import { GPSDevicesModule } from './gps-devices/gps-devices.module';
import { AuditLog } from './audit-log/audit-log.entity';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ExcelModule } from './common/excel/excel.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { EventModule } from './events/event.module';
import { GeofenceModule } from './geofences/geofence.module';
import { NotificationModule } from './notifications/notification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { LiveMapModule } from './live-map/live-map.module';
import { ReportsModule } from './reports/reports.module';
import { MobileModule } from './mobile/mobile.module';
import { SubscriptionModule } from './subscriptions/subscription.module';
import { NearestVehicleModule } from './nearest-vehicle/nearest-vehicle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const db = config.get('database', { infer: true });
        if (db.type === 'postgres') {
          return {
            type: 'postgres' as const,
            host: db.host,
            port: db.port,
            username: db.username,
            password: db.password,
            database: db.database,
            autoLoadEntities: true,
            synchronize: true,
          };
        }
        // sql.js = pure-JS/WASM SQLite (no native toolchain required).
        return {
          type: 'sqljs' as const,
          location: db.url,
          autoSave: true,
          autoLoadEntities: true,
          // Template convenience — use migrations before production.
          synchronize: true,
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      Tenant,
      Vehicle,
      ServingArea,
      Driver,
      GPSDevice,
      GPSReading,
      AuditLog,
    ]),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    TenantsModule,
    VehiclesModule,
    ServingAreasModule,
    DriversModule,
    GPSDevicesModule,
    AuditLogModule,
    ExcelModule,
    TelemetryModule,
    EventModule,
    GeofenceModule,
    NotificationModule,
    DashboardModule,
    SettingsModule,
    LiveMapModule,
    ReportsModule,
    MobileModule,
    SubscriptionModule,
    NearestVehicleModule,
  ],
  providers: [
    SeedService,
    // Global guards: authentication first, then RBAC authorization.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantResolverMiddleware)
      .forRoutes('*');
  }
}
