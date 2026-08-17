import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RequireSuperUser } from '../common/decorators/require-super-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

/**
 * Tenant administration — accessible to super users only.
 */
@Controller('tenants')
@RequireSuperUser()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Permissions('tenants:read')
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Permissions('tenants:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @Permissions('tenants:create')
  create(@Body() dto: CreateTenantDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tenantsService.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('tenants:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tenantsService.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('tenants:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.tenantsService.remove(id, actor);
  }
}
