import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GlobalSettingsService } from './global-settings.service';

@Controller('settings/global')
export class GlobalSettingsController {
  constructor(private readonly service: GlobalSettingsService) {}

  @Get()
  @Permissions('settings:global:read')
  async findAll() {
    return this.service.findAll();
  }

  @Get(':key')
  @Permissions('settings:global:read')
  async findByKey(@Param('key') key: string) {
    return this.service.findByKey(key);
  }

  @Put()
  @Permissions('settings:global:update')
  async bulkSet(@Body() body: { entries: { key: string; value: string; category?: string; description?: string }[] }) {
    return this.service.bulkSet(body.entries);
  }

  @Put(':key')
  @Permissions('settings:global:update')
  async set(@Param('key') key: string, @Body() body: { value: string; category?: string; description?: string }) {
    return this.service.set(key, body.value, body.category, body.description);
  }
}
