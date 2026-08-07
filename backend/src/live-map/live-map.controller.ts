import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
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
}
