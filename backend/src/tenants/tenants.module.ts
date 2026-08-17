import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantPublicController } from './tenant-public.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AuditLogModule],
  controllers: [TenantsController, TenantPublicController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
