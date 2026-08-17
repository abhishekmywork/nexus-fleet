import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../../users/user.entity';
import { Role } from '../../roles/role.entity';
import { Permission } from '../../permissions/permission.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { AuditLog } from '../../audit-log/audit-log.entity';
import { PERMISSIONS } from '../../constants/permissions';
import type { AppConfig } from '../../config/configuration';
import { LessThan } from 'typeorm';

/**
 * Bootstraps demo data on first run: permission catalog, system roles, a
 * super user, and demo tenants. Idempotent — skips anything that exists.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepo: Repository<Permission>,
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get('autoSeed', { infer: true })) return;

    const permissions = await this.seedPermissions();
    const roles = await this.seedRoles(permissions);
    const tenants = await this.seedTenants();
    await this.seedUsers(roles, tenants);

    await this.purgeOldAuditLogs();

    this.logger.log('Seeding complete');
  }

  private async purgeOldAuditLogs(): Promise<void> {
    const retentionDays = this.config.get('auditLogRetentionDays', {
      infer: true,
    });
    if (retentionDays === 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.auditLogRepo.delete({
      createdAt: LessThan(cutoff),
    });
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(
        `Purged ${deleted} audit logs older than ${retentionDays} days`,
      );
    }
  }

  private async seedPermissions(): Promise<Permission[]> {
    const existing = await this.permissionsRepo.find();
    const existingKeys = new Set(existing.map((p) => p.key));

    const toCreate = PERMISSIONS.filter((p) => !existingKeys.has(p.key)).map(
      (p) => this.permissionsRepo.create(p),
    );
    if (toCreate.length) {
      await this.permissionsRepo.save(toCreate);
      this.logger.log(`Seeded ${toCreate.length} permissions`);
    }
    return this.permissionsRepo.find();
  }

  private async seedRoles(permissions: Permission[]): Promise<Role[]> {
    const all = await this.rolesRepo.find();

    const systemRoles = [
      {
        key: 'SUPER_ADMIN',
        name: 'Super Admin',
        description: 'Full access to every permission',
        permissionKeys: permissions.map((p) => p.key),
      },
      {
        key: 'ADMIN',
        name: 'Admin',
        description: 'Manage users, roles and general settings',
        permissionKeys: [
          // Page permissions
          'page:live_map', 'page:dashboard', 'page:analytics', 'page:reports',
          'page:vehicles', 'page:serving_areas', 'page:drivers', 'page:gps_devices',
          'page:telemetry', 'page:events', 'page:geofences',
          'page:users', 'page:roles', 'page:settings', 'page:activity_logs', 'page:my_subscription',
          // Action permissions
          'users:read', 'users:create', 'users:update', 'users:delete',
          'roles:read', 'roles:create', 'roles:update', 'permissions:read',
          'vehicles:read', 'vehicles:create', 'vehicles:update',
          'serving_areas:read', 'serving_areas:create', 'serving_areas:update',
          'drivers:read', 'drivers:create', 'drivers:update',
          'gps_devices:read', 'gps_devices:create', 'gps_devices:update',
          'audit_logs:read', 'telemetry:read',
          'events:read', 'events:update',
          'geofences:read', 'geofences:create', 'geofences:update', 'geofences:delete',
          'notifications:read', 'notifications:update',
          'settings:tenant:read', 'settings:tenant:update',
        ],
      },
      {
        key: 'MANAGER',
        name: 'Manager',
        description: 'Read and update users',
        permissionKeys: [
          // Page permissions
          'page:live_map', 'page:dashboard', 'page:analytics', 'page:reports',
          'page:vehicles', 'page:drivers', 'page:telemetry', 'page:events', 'page:geofences',
          'page:users', 'page:settings', 'page:activity_logs',
          // Action permissions
          'users:read', 'users:update', 'telemetry:read', 'events:read', 'geofences:read',
          'audit_logs:read',
          'notifications:read', 'settings:tenant:read', 'settings:tenant:update',
        ],
      },
      {
        key: 'VIEWER',
        name: 'Viewer',
        description: 'Read-only access',
        permissionKeys: [
          // Page permissions
          'page:live_map', 'page:dashboard', 'page:analytics', 'page:reports',
          'page:vehicles', 'page:drivers', 'page:telemetry', 'page:events', 'page:geofences',
          'page:users', 'page:roles', 'page:settings', 'page:activity_logs',
          // Action permissions
          'users:read', 'roles:read', 'permissions:read', 'telemetry:read', 'audit_logs:read',
          'events:read', 'geofences:read', 'notifications:read', 'settings:tenant:read',
        ],
      },
    ];

    const byKey = new Map(permissions.map((p) => [p.key, p]));
    const created: Role[] = [];

    for (const def of systemRoles) {
      let role = all.find((r) => r.key === def.key);
      if (!role) {
        role = this.rolesRepo.create({
          key: def.key,
          name: def.name,
          description: def.description,
          isSystem: true,
          permissions: def.permissionKeys
            .map((k) => byKey.get(k))
            .filter((p): p is Permission => Boolean(p)),
        });
        await this.rolesRepo.save(role);
        created.push(role);
        this.logger.log(`Seeded role ${def.key}`);
      } else {
        // Update existing roles: add any new permissions they should have
        const targetKeys = new Set(def.permissionKeys);
        const currentKeys = new Set(role.permissions.map((p) => p.key));
        const missing = [...targetKeys].filter((k) => !currentKeys.has(k));
        if (missing.length) {
          role.permissions = [
            ...role.permissions,
            ...missing.map((k) => byKey.get(k)!).filter(Boolean),
          ];
          await this.rolesRepo.save(role);
          this.logger.log(`Updated role ${def.key} with ${missing.length} new permissions`);
        }
      }
    }

    return all.length ? all : this.rolesRepo.find();
  }

  private async seedTenants(): Promise<Tenant[]> {
    const cfg = this.config.get('seed', { infer: true });
    const tenants: Tenant[] = [];

    for (const [name, slug] of [
      [cfg.defaultTenantName, cfg.defaultTenantSlug],
      [cfg.demoTenantName, cfg.demoTenantSlug],
    ] as const) {
      let tenant = await this.tenantsRepo.findOne({ where: { slug } });
      if (!tenant) {
        tenant = await this.tenantsRepo.save(this.tenantsRepo.create({ name, slug }));
        tenants.push(tenant);
        this.logger.log(`Seeded tenant ${slug}`);
      } else {
        tenants.push(tenant);
      }
    }
    return tenants;
  }

  private async seedUsers(
    roles: Role[],
    tenants: Tenant[],
  ): Promise<void> {
    const cfg = this.config.get('seed', { infer: true });
    const [defaultTenant, demoTenant] = tenants;
    const byKey = new Map(roles.map((r) => [r.key, r]));

    // Super user
    const existingAdmin = await this.usersRepo.findOne({
      where: { email: cfg.adminEmail },
    });
    if (!existingAdmin) {
      await this.usersRepo.save(
        this.usersRepo.create({
          email: cfg.adminEmail,
          passwordHash: await bcrypt.hash(cfg.adminPassword, 10),
          firstName: 'Super',
          lastName: 'Admin',
          isSuperUser: true,
          isActive: true,
          tenantId: defaultTenant?.id ?? null,
          roles: byKey.get('SUPER_ADMIN') ? [byKey.get('SUPER_ADMIN')!] : [],
        }),
      );
      this.logger.log(`Seeded super user ${cfg.adminEmail}`);
    }

    // Demo manager (scoped to the demo tenant, proves tenant isolation)
    const demoEmail = 'manager@acme.io';
    const existingDemo = await this.usersRepo.findOne({
      where: { email: demoEmail },
    });
    if (!existingDemo && demoTenant) {
      await this.usersRepo.save(
        this.usersRepo.create({
          email: demoEmail,
          passwordHash: await bcrypt.hash('Demo123!', 10),
          firstName: 'Dana',
          lastName: 'Manager',
          isSuperUser: false,
          isActive: true,
          tenantId: demoTenant.id,
          roles: byKey.get('MANAGER') ? [byKey.get('MANAGER')!] : [],
        }),
      );
      this.logger.log(`Seeded demo user ${demoEmail}`);
    }
  }
}
