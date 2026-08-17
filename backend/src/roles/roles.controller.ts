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
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { RolesService } from './roles.service';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  UpdateRoleDto,
} from './dto/role.dto';

/**
 * RBAC control plane: list/create/update/delete roles and assign
 * permissions to them.
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles:read')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions('roles:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Permissions('roles:create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('roles:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('roles:delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.remove(id, actor);
  }

  @Put(':id/permissions')
  @Permissions('roles:update')
  assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.assignPermissions(id, dto, actor);
  }
}
