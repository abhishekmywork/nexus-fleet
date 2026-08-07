import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { VehiclesService } from './vehicles.service';
import {
  AssignServingAreasDto,
  CreateVehicleDto,
  UpdateVehicleDto,
} from './dto/vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get()
  @Permissions('vehicles:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.findAll(actor, tenantId);
  }

  @Get('export')
  @Permissions('vehicles:read')
  async export(
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportExcel(actor);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=vehicles.xlsx',
    });
    res.send(buffer);
  }

  @Get('sample')
  @Permissions('vehicles:read')
  async sample(@Res() res: Response) {
    const buffer = await this.service.generateSample();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=vehicles-sample.xlsx',
    });
    res.send(buffer);
  }

  @Post('import')
  @Permissions('vehicles:create')
  import(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: CreateVehicleDto[] },
  ) {
    return this.service.validateImport(actor, body.rows);
  }

  @Post('import/confirm')
  @Permissions('vehicles:create')
  importConfirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: CreateVehicleDto[] },
  ) {
    return this.service.executeImport(actor, body.rows);
  }

  @Post()
  @Permissions('vehicles:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.service.create(actor, dto);
  }

  @Get(':id')
  @Permissions('vehicles:read')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(actor, id);
  }

  @Patch(':id')
  @Permissions('vehicles:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.service.update(actor, id, dto);
  }

  @Delete(':id')
  @Permissions('vehicles:delete')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(actor, id);
  }

  @Put(':id/areas')
  @Permissions('vehicles:update')
  assignServingAreas(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignServingAreasDto,
  ) {
    return this.service.assignServingAreas(actor, id, dto);
  }
}
