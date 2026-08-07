import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TelemetryConsumerService } from './telemetry-consumer.service';
import { TelemetryService, TelemetryQueryDto } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly consumer: TelemetryConsumerService,
    private readonly telemetry: TelemetryService,
  ) {}

  @Get('status')
  @Permissions('gps_devices:read')
  async status() {
    const connected = await this.consumer.ping();
    return { connected };
  }

  @Get('readings')
  @Permissions('telemetry:read')
  async readings(@Query() query: TelemetryQueryDto) {
    return this.telemetry.findAll(query);
  }

  @Get('readings/latest')
  @Permissions('telemetry:read')
  async latestReadings() {
    return this.telemetry.findLatestPerDevice();
  }

  @Get('trail/:deviceId')
  @Permissions('telemetry:read')
  async trail(@Param('deviceId') deviceId: string) {
    return this.telemetry.findTodayTrail(deviceId);
  }
}
