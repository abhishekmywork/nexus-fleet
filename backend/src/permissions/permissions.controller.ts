import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /** Catalog of all permissions available to attach to roles. */
  @Get()
  @Permissions('permissions:read')
  findAll() {
    return this.permissionsService.findAll();
  }
}
