import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { TenantsService } from './tenants.service';

/**
 * Public tenant endpoints — no authentication required.
 * Used by the frontend to resolve tenant info from a subdomain slug.
 */
@Controller('tenants')
export class TenantPublicController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Returns basic tenant info (id, name, slug) for a given slug.
   * Called by the frontend when it detects a subdomain.
   */
  @Public()
  @Get('public/by-slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundException('Tenant not found or inactive');
    }
    return tenant;
  }
}
