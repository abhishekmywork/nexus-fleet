import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { Permission } from '../permissions/permission.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission]), AuditLogModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
