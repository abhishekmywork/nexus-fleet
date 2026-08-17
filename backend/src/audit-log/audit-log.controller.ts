import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log.dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  @Permissions('audit_logs:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AuditLogQueryDto,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(
      actor,
      query,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
