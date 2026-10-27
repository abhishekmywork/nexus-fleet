import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequireSuperUser } from '../common/decorators/require-super-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperUserGuard } from '../common/guards/super-user.guard';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { OpsService } from './ops.service';

/**
 * Telemetry pipeline and data-quality reporting.
 *
 * Infrastructure panels (stream, PEL, orphans, integrity) are super-user only.
 * `SuperUserGuard` only enforces routes that also carry `@RequireSuperUser()`,
 * so both decorators are required together. Per-device quality is
 * tenant-scoped like the rest of analytics.
 */
@Controller('ops')
@Permissions('page:analytics')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('ingest')
  @RequireSuperUser()
  @UseGuards(SuperUserGuard)
  getIngest() {
    return this.opsService.getIngest();
  }

  @Get('volume')
  @RequireSuperUser()
  @UseGuards(SuperUserGuard)
  getVolume(@CurrentUser() user: AuthenticatedUser, @Query('hours') hours?: string) {
    return this.opsService.getVolume(user, hours ? Number(hours) : 24);
  }

  @Get('orphans')
  @RequireSuperUser()
  @UseGuards(SuperUserGuard)
  getOrphans() {
    return this.opsService.getOrphans();
  }

  @Get('integrity')
  @RequireSuperUser()
  @UseGuards(SuperUserGuard)
  getIntegrity(@CurrentUser() user: AuthenticatedUser) {
    return this.opsService.getIntegrity(user);
  }

  @Get('devices')
  getDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.opsService.getDevices(user);
  }
}
