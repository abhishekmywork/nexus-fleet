import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Permissions('events:read')
  async getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getOverview(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  @Get('event-heatmap')
  @Permissions('events:read')
  async getEventHeatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getEventHeatmap(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  @Get('speed-analysis')
  @Permissions('events:read')
  async getSpeedAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getSpeedAnalysis(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  @Get('stoppage-intel')
  @Permissions('vehicles:read')
  async getStoppageIntel(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getStoppageIntel(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  @Get('geofence-violations')
  @Permissions('events:read')
  async getGeofenceViolations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getGeofenceViolations(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  @Get('driver-scores')
  @Permissions('vehicles:read')
  async getDriverScores(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getDriverScores(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  @Get('device-health')
  @Permissions('vehicles:read')
  async getDeviceHealth(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.analyticsService.getDeviceHealth(user, this.parseDate(from), this.parseDate(to), vehicleId);
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }
}
