import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Permissions('events:read')
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getStats(user);
  }

  @Get('events-by-type')
  @Permissions('events:read')
  async getEventsByType(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getEventsByType(user);
  }

  @Get('recent-events')
  @Permissions('events:read')
  async getRecentEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getRecentEvents(
      user,
      limit ? parseInt(limit, 10) : 15,
    );
  }

  @Get('vehicle-positions')
  @Permissions('vehicles:read')
  async getVehiclePositions(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getVehiclePositions(user);
  }

  @Get('telemetry-summary')
  @Permissions('telemetry:read')
  async getTelemetrySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getTelemetrySummary(user);
  }
}
