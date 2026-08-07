import { Controller, Get, Put, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantSettingsService, UpdateTenantSettingsDto } from './tenant-settings.service';

@Controller('settings/tenant')
export class TenantSettingsController {
  constructor(private readonly service: TenantSettingsService) {}

  @Get()
  @Permissions('settings:tenant:read')
  async findOne(@Req() req: Request) {
    const user = (req as any).user;
    const tenantId: string = user?.tenantId ?? '';
    return this.service.getOrCreate(tenantId);
  }

  @Put()
  @Permissions('settings:tenant:update')
  async update(@Req() req: Request, @Body() dto: UpdateTenantSettingsDto) {
    const user = (req as any).user;
    const tenantId: string = user?.tenantId ?? '';
    return this.service.update(tenantId, dto);
  }
}
