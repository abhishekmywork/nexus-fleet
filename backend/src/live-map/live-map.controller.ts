import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantResolverMiddleware } from '../common/middleware/tenant-resolver.middleware';
import { LiveMapService } from './live-map.service';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';

@Controller('live-map')
export class LiveMapController {
  constructor(private readonly liveMapService: LiveMapService) {}

  @Get('positions')
  @Permissions('telemetry:read')
  async getPositions(@Req() req: Request) {
    const user = (req as any).user as AuthenticatedUser;
    return this.liveMapService.getActivePositions(user);
  }

  @Public()
  @Get('public/positions')
  async getPublicPositions(@Req() req: Request) {
    const slug =
      (req.headers['x-tenant-slug'] as string) ||
      TenantResolverMiddleware.extractSubdomain(req.headers.host ?? '');
    if (!slug) return [];
    return this.liveMapService.getPublicPositions(slug);
  }
}
