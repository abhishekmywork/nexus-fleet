import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { MobileService } from './mobile.service';

@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Post('fcm-token')
  @Permissions('telemetry:read')
  async registerFcmToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { token: string; platform: string },
  ) {
    return this.mobileService.registerFcmToken(user, body.token, body.platform);
  }

  @Get('my-vehicle')
  @Permissions('drivers:read')
  async getMyVehicle(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getMyVehicle(user);
  }

  @Patch('duty')
  @Permissions('drivers:read')
  async toggleDuty(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { active: boolean },
  ) {
    return this.mobileService.toggleDuty(user, body.active);
  }
}
