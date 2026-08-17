import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { mapUser } from '../common/mappers/user.mapper';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import {
  AssignRolesDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/user.dto';

/**
 * Tenant-scoped user administration. Regular users can only see/manage
 * users inside their own tenant; super users can operate across tenants.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async findAll(actor: AuthenticatedUser, tenantId?: string) {
    const qb = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission');

    if (actor.isSuperUser) {
      if (tenantId) qb.andWhere('user.tenantId = :tenantId', { tenantId });
    } else {
      if (!actor.tenantId) {
        throw new ForbiddenException('Account has no tenant assigned');
      }
      qb.andWhere('user.tenantId = :tenantId', { tenantId: actor.tenantId });
    }

    const rows = await qb.orderBy('user.createdAt', 'DESC').getMany();
    return rows.map(mapUser);
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    this.assertCanAccess(actor, user);
    return mapUser(user);
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    const tenantId = actor.isSuperUser ? (dto.tenantId ?? null) : actor.tenantId;
    const roles = dto.roleKeys?.length
      ? await this.loadRoles(dto.roleKeys)
      : [];

    const user = this.users.create({
      email,
      phone: dto.phone ?? null,
      passwordHash: await bcrypt.hash(dto.password, 10),
      firstName: dto.firstName,
      lastName: dto.lastName,
      isActive: true,
      isSuperUser: false,
      tenantId,
      roles,
    });
    const saved = await this.users.save(user);
    return mapUser(saved);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    this.assertCanAccess(actor, user);

    if (user.isSuperUser && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate a super user');
    }

    if (dto.email !== undefined) {
      const newEmail = dto.email.toLowerCase();
      if (newEmail !== user.email) {
        const existing = await this.users.findOne({ where: { email: newEmail } });
        if (existing) throw new ConflictException('Email is already registered');
        user.email = newEmail;
      }
    }

    Object.assign(user, {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    const saved = await this.users.save(user);
    return mapUser(saved);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    this.assertCanAccess(actor, user);

    if (user.id === actor.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    if (user.isSuperUser) {
      throw new ForbiddenException('Super user accounts cannot be deleted');
    }
    await this.users.remove(user);
  }

  async assignRoles(actor: AuthenticatedUser, id: string, dto: AssignRolesDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    this.assertCanAccess(actor, user);

    user.roles = await this.loadRoles(dto.roleKeys);
    const saved = await this.users.save(user);
    return mapUser(saved);
  }

  /** Loads roles by key, failing fast on unknown keys. */
  private async loadRoles(roleKeys: string[]): Promise<Role[]> {
    const roles = await this.roles.find({
      where: roleKeys.map((key) => ({ key })),
    });
    if (roles.length !== new Set(roleKeys).size) {
      throw new NotFoundException('One or more roles were not found');
    }
    return roles;
  }

  private assertCanAccess(actor: AuthenticatedUser, user: User): void {
    if (actor.isSuperUser) return;
    if (user.tenantId !== actor.tenantId) {
      throw new ForbiddenException('You do not have access to this user');
    }
  }
}
