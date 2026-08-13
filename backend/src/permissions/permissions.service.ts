import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './permission.entity';
import { PERMISSIONS } from '../constants/permissions';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  private async seed(): Promise<void> {
    const existing = await this.permissions.find();
    const existingKeys = new Set(existing.map((p) => p.key));

    // Insert new permissions
    const toCreate = PERMISSIONS.filter((p) => !existingKeys.has(p.key)).map(
      (p) => this.permissions.create(p),
    );

    if (toCreate.length) {
      await this.permissions.save(toCreate);
      this.logger.log(`Seeded ${toCreate.length} new permissions`);
    }

    // Backfill `type` for existing permissions that don't have it set
    const toUpdate = existing.filter((p) => !p.type || p.type === ('' as any));
    if (toUpdate.length) {
      for (const p of toUpdate) {
        p.type = p.key.startsWith('page:') ? 'page' : 'action';
      }
      await this.permissions.save(toUpdate);
      this.logger.log(`Backfilled type for ${toUpdate.length} existing permissions`);
    }
  }

  findAll() {
    return this.permissions.find({ order: { module: 'ASC', key: 'ASC' } });
  }
}
