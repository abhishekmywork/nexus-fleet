import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequireSuperUser } from '../common/decorators/require-super-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SubscriptionPlanService } from './subscription-plan.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/subscription-plan.dto';

@Controller('subscription-plans')
@RequireSuperUser()
export class SubscriptionPlanController {
  constructor(private readonly planService: SubscriptionPlanService) {}

  @Get()
  @Permissions('subscription_plans:read')
  findAll() {
    return this.planService.findAll();
  }

  @Get('active')
  @Permissions('subscription_plans:read')
  findActive() {
    return this.planService.findActive();
  }

  @Get(':id')
  @Permissions('subscription_plans:read')
  findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @Post()
  @Permissions('subscription_plans:create')
  create(@Body() dto: CreatePlanDto) {
    return this.planService.create(dto);
  }

  @Patch(':id')
  @Permissions('subscription_plans:update')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.planService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('subscription_plans:delete')
  remove(@Param('id') id: string) {
    return this.planService.remove(id);
  }
}
