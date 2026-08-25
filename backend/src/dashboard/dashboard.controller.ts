import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { DashboardService } from './dashboard.service';

export interface DateRangeParams {
  from?: string;
  to?: string;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Permissions('events:read')
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getStats(user, this.parseRange(from, to));
  }

  @Get('events-by-type')
  @Permissions('events:read')
  async getEventsByType(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getEventsByType(user, this.parseRange(from, to));
  }

  @Get('recent-events')
  @Permissions('events:read')
  async getRecentEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getRecentEvents(
      user,
      limit ? parseInt(limit, 10) : 15,
      this.parseRange(from, to),
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

  private parseRange(from?: string, to?: string): { start: Date; end: Date } | null {
    if (!from || !to) return null;
    const startDate = new Date(from);
    const endDate = new Date(to);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
    return { start: startDate, end: endDate };
  }
}
