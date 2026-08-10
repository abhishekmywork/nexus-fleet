import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * Resolves the tenant from the subdomain of the incoming request's Host
 * header and attaches it to `req.tenant`.
 *
 * For example, `ranaghat.mstechind.com` → slug `ranaghat` → tenant lookup.
 * The root domain `mstechind.com` (no subdomain) leaves `req.tenant` null,
 * which is used by the super-admin panel.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Priority: X-Tenant-Slug header > subdomain from Host header
    const headerSlug = req.headers['x-tenant-slug'] as string | undefined;
    const host = req.headers.host ?? '';
    const slug = headerSlug || TenantResolverMiddleware.extractSubdomain(host);

    if (slug) {
      const tenant = await this.tenants.findOne({
        where: { slug, status: 'active' as const },
      });
      (req as any).tenant = tenant ?? null;
      (req as any).tenantSlug = slug;
    } else {
      (req as any).tenant = null;
      (req as any).tenantSlug = null;
    }

    next();
  }

  /**
   * Extracts the subdomain from a Host header value.
   * - `ranaghat.mstechind.com` → `ranaghat`
   * - `mstechind.com` → `null` (root domain)
   * - `localhost:3000` → `null`
   * - `147.93.31.140` → `null` (IP address)
   */
  static extractSubdomain(host: string): string | null {
    // Strip port
    const hostname = host.split(':')[0];

    // Skip IPs
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;

    // Skip localhost
    if (hostname === 'localhost') return null;

    // Split by dots
    const parts = hostname.split('.');

    // Need at least 3 parts for a subdomain (sub.domain.tld)
    if (parts.length < 3) return null;

    // The subdomain is everything before the last two parts
    // e.g., ranaghat.mstechind.com → parts[0] = 'ranaghat'
    return parts[0];
  }
}
