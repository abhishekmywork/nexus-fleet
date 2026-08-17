import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { Permission } from '../permissions/permission.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  UpdateRoleDto,
} from './dto/role.dto';

const mapRole = (role: Role) => ({
  id: role.id,
  key: role.key,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  permissions: role.permissions.map((p) => ({
    key: p.key,
    name: p.name,
    module: p.module,
  })),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

/**
 * Role + permission management — the RBAC control plane.
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    const roles = await this.roles.find({
      relations: { permissions: true },
      order: { createdAt: 'ASC' },
    });
    return roles.map(mapRole);
  }

  async findOne(id: string) {
    const role = await this.roles.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    return mapRole(role);
  }

  async create(dto: CreateRoleDto, actor?: AuthenticatedUser) {
    const existing = await this.roles.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Role key ${dto.key} already exists`);

    const permissions = dto.permissionKeys?.length
      ? await this.loadPermissions(dto.permissionKeys)
      : [];

    const role = await this.roles.save(
      this.roles.create({
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        isSystem: false,
        permissions,
      }),
    );
    const result = await this.findOne(role.id);

    if (actor) {
      await this.auditLog.log(actor, {
        action: 'created',
        entityType: 'role',
        entityId: role.id,
        entityName: role.name,
      });
    }

    return result;
  }

  async update(id: string, dto: UpdateRoleDto, actor?: AuthenticatedUser) {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    this.assertEditable(role);

    Object.assign(role, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
    });
    await this.roles.save(role);
    const result = await this.findOne(id);

    if (actor) {
      await this.auditLog.log(actor, {
        action: 'updated',
        entityType: 'role',
        entityId: role.id,
        entityName: role.name,
      });
    }

    return result;
  }

  async remove(id: string, actor?: AuthenticatedUser): Promise<void> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    this.assertEditable(role);
    await this.roles.remove(role);

    if (actor) {
      await this.auditLog.log(actor, {
        action: 'deleted',
        entityType: 'role',
        entityId: role.id,
        entityName: role.name,
      });
    }
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto, actor?: AuthenticatedUser) {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    role.permissions = await this.loadPermissions(dto.permissionKeys);
    await this.roles.save(role);
    const result = await this.findOne(id);

    if (actor) {
      await this.auditLog.log(actor, {
        action: 'updated',
        entityType: 'role',
        entityId: role.id,
        entityName: role.name,
        relatedName: 'permissions changed',
      });
    }

    return result;
  }

  private assertEditable(role: Role) {
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified or deleted');
    }
  }

  private async loadPermissions(permissionKeys: string[]): Promise<Permission[]> {
    const permissions = await this.permissions.find({
      where: permissionKeys.map((key) => ({ key })),
    });
    if (permissions.length !== new Set(permissionKeys).size) {
      throw new BadRequestException('One or more permissions were not found');
    }
    return permissions;
  }
}
