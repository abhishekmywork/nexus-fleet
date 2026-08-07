import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

const mapTenant = (tenant: Tenant, userCount = 0) => ({
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  status: tenant.status,
  userCount,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt,
});

/**
 * Tenant lifecycle management. Controllers enforce that only super users
 * can reach these operations.
 */
@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {}

  async findAll() {
    const tenants = await this.tenants.find({
      relations: { users: true },
      order: { createdAt: 'ASC' },
    });
    return tenants.map((t) => mapTenant(t, t.users.length));
  }

  async findOne(id: string) {
    const tenant = await this.tenants.findOne({
      where: { id },
      relations: { users: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return mapTenant(tenant, tenant.users.length);
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.tenants.findOne({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Tenant slug already exists');

    const tenant = await this.tenants.save(
      this.tenants.create({ name: dto.name, slug: dto.slug, status: 'active' }),
    );
    return mapTenant(tenant);
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    Object.assign(tenant, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    await this.tenants.save(tenant);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.tenants.findOne({
      where: { id },
      relations: { users: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.users.length > 0) {
      throw new ConflictException(
        'Cannot delete a tenant that still has users. Suspend it instead, or reassign users first.',
      );
    }
    await this.tenants.remove(tenant);
  }
}
