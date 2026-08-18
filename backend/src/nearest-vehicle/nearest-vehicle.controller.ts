import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { NearestVehicleService } from './nearest-vehicle.service';

@Controller('nearest-vehicle')
export class NearestVehicleController {
  constructor(private readonly nearestService: NearestVehicleService) {}

  @Get(':vehicleId')
  @Permissions('vehicles:read')
  findNearest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ) {
    return this.nearestService.findNearest(user, vehicleId);
  }
}
