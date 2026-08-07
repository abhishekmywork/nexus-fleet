import { Controller, Get, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { ReportsService, ReportQuery } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('vehicle-trips')
  @Permissions('telemetry:read')
  async vehicleTrips(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.vehicleTripReport(user, q);
  }

  @Get('daily-summary')
  @Permissions('telemetry:read')
  async dailySummary(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.dailySummaryReport(user, q);
  }

  @Get('speed-violations')
  @Permissions('telemetry:read')
  async speedViolations(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.speedViolationReport(user, q);
  }

  @Get('idle-stoppages')
  @Permissions('telemetry:read')
  async idleStoppages(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.idleReport(user, q);
  }

  @Get('ignition')
  @Permissions('telemetry:read')
  async ignition(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.ignitionReport(user, q);
  }

  @Get('geofence-entry-exit')
  @Permissions('telemetry:read')
  async geofenceEntryExit(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.geofenceEntryExitReport(user, q);
  }

  @Get('geofence-summary')
  @Permissions('telemetry:read')
  async geofenceSummary(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.geofenceSummaryReport(user, q);
  }

  @Get('event-log')
  @Permissions('telemetry:read')
  async eventLog(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.eventLogReport(user, q);
  }

  @Get('driver-activity')
  @Permissions('telemetry:read')
  async driverActivity(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.driverActivityReport(user, q);
  }

  @Get('device-health')
  @Permissions('telemetry:read')
  async deviceHealth(@CurrentUser() user: AuthenticatedUser, @Query() q: ReportQuery) {
    return this.reports.deviceHealthReport(user, q);
  }
}
