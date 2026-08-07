import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { EventService, EventQueryDto } from './event.service';
import type { EventType } from './event.entity';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  @Permissions('events:read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EventQueryDto,
  ) {
    return this.eventService.findAll(user, query);
  }

  @Get('stats')
  @Permissions('events:read')
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.eventService.getStats(user);
  }

  @Get('rules')
  @Permissions('events:read')
  async getRules() {
    return this.eventService.getRules();
  }

  @Patch('rules/:id')
  @Permissions('events:update')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: { enabled?: boolean; thresholds?: Record<string, any> },
  ) {
    return this.eventService.updateRule(id, dto);
  }

  @Patch(':id/acknowledge')
  @Permissions('events:update')
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventService.acknowledge(id, user);
  }
}
