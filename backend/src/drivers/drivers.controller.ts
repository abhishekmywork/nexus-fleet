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
import { DriversService } from './drivers.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Get()
  @Permissions('drivers:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.findAll(actor, tenantId);
  }

  @Get('export')
  @Permissions('drivers:read')
  async exportExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportExcel(actor);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="drivers.xlsx"',
    });
    res.end(buffer);
  }

  @Get('sample')
  @Permissions('drivers:read')
  async sampleExcel(@Res() res: Response) {
    const buffer = await this.service.generateSample();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="drivers-sample.xlsx"',
    });
    res.end(buffer);
  }

  @Post('import')
  @Permissions('drivers:create')
  importExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: Record<string, any>[] },
  ) {
    return this.service.validateImport(actor, body.rows);
  }

  @Post('import/confirm')
  @Permissions('drivers:create')
  importConfirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: CreateDriverDto[] },
  ) {
    return this.service.executeImport(actor, body.rows);
  }

  @Post()
  @Permissions('drivers:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateDriverDto,
  ) {
    return this.service.create(actor, dto);
  }

  @Get(':id')
  @Permissions('drivers:read')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(actor, id);
  }

  @Patch(':id')
  @Permissions('drivers:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.service.update(actor, id, dto);
  }

  @Delete(':id')
  @Permissions('drivers:delete')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(actor, id);
  }
}
