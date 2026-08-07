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
import { ServingAreasService } from './serving-areas.service';
import { CreateServingAreaDto, UpdateServingAreaDto } from './dto/serving-area.dto';

@Controller('serving-areas')
export class ServingAreasController {
  constructor(private readonly service: ServingAreasService) {}

  @Get()
  @Permissions('serving_areas:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.findAll(actor, tenantId);
  }

  @Get('export')
  @Permissions('serving_areas:read')
  async exportExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportExcel(actor);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="serving-areas.xlsx"',
    });
    res.end(buffer);
  }

  @Get('sample')
  @Permissions('serving_areas:read')
  async downloadSample(@Res() res: Response) {
    const buffer = await this.service.generateSample();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="serving-areas-sample.xlsx"',
    });
    res.end(buffer);
  }

  @Post('import')
  @Permissions('serving_areas:create')
  import(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: Record<string, any>[] },
  ) {
    return this.service.validateImport(actor, body.rows);
  }

  @Post('import/confirm')
  @Permissions('serving_areas:create')
  confirmImport(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { rows: CreateServingAreaDto[] },
  ) {
    return this.service.executeImport(actor, body.rows);
  }

  @Post()
  @Permissions('serving_areas:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateServingAreaDto,
  ) {
    return this.service.create(actor, dto);
  }

  @Get(':id')
  @Permissions('serving_areas:read')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(actor, id);
  }

  @Patch(':id')
  @Permissions('serving_areas:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServingAreaDto,
  ) {
    return this.service.update(actor, id, dto);
  }

  @Delete(':id')
  @Permissions('serving_areas:delete')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(actor, id);
  }
}
