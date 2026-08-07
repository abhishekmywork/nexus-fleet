import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { GPSDevicesService } from './gps-devices.service';
import { CreateGPSDeviceDto, UpdateGPSDeviceDto } from './dto/gps-device.dto';

@Controller('gps-devices')
export class GPSDevicesController {
  constructor(private readonly service: GPSDevicesService) {}

  @Get()
  @Permissions('gps_devices:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.findAll(actor, tenantId);
  }

  @Get('export')
  @Permissions('gps_devices:read')
  async export(
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportExcel(actor);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=gps-devices.xlsx',
    });
    res.send(buffer);
  }

  @Get('sample')
  @Permissions('gps_devices:read')
  async sample(@Res() res: Response) {
    const buffer = await this.service.generateSample();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=gps-devices-sample.xlsx',
    });
    res.send(buffer);
  }

  @Post('import')
  @Permissions('gps_devices:create')
  import(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: CreateGPSDeviceDto[] },
  ) {
    return this.service.validateImport(actor, body.rows);
  }

  @Post('import/confirm')
  @Permissions('gps_devices:create')
  importConfirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: CreateGPSDeviceDto[] },
  ) {
    return this.service.executeImport(actor, body.rows);
  }

  @Get(':id')
  @Permissions('gps_devices:read')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(actor, id);
  }

  @Get(':id/readings')
  @Permissions('gps_devices:read')
  getReadings(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getReadings(actor, id, limit ? parseInt(limit, 10) : 100);
  }

  @Post()
  @Permissions('gps_devices:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateGPSDeviceDto,
  ) {
    return this.service.create(actor, dto);
  }

  @Patch(':id')
  @Permissions('gps_devices:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGPSDeviceDto,
  ) {
    return this.service.update(actor, id, dto);
  }

  @Delete(':id')
  @Permissions('gps_devices:delete')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(actor, id);
  }
}
