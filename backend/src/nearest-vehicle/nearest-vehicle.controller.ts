import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { NearestVehicleService } from './nearest-vehicle.service';

@Controller('nearest-vehicle')
export class NearestVehicleController {
  constructor(private readonly nearestService: NearestVehicleService) {}

  @Get(':vehicleId')
  findNearest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.nearestService.findNearest(user, vehicleId);
  }
}
