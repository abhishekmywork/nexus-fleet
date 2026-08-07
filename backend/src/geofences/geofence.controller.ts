import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { GeofenceService, CreateGeofenceDto } from './geofence.service';

@Controller('geofences')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Get()
  @Permissions('geofences:read')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.geofenceService.findAll(user);
  }

  @Get(':id')
  @Permissions('geofences:read')
  async findOne(@Param('id') id: string) {
    return this.geofenceService.findOne(id);
  }

  @Post()
  @Permissions('geofences:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGeofenceDto,
  ) {
    return this.geofenceService.create(user, dto);
  }

  @Put(':id')
  @Permissions('geofences:update')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateGeofenceDto>,
  ) {
    return this.geofenceService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('geofences:delete')
  async remove(@Param('id') id: string) {
    return this.geofenceService.remove(id);
  }

  @Post('import')
  @Permissions('geofences:create')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.geofenceService.importFromBuffer(
      user,
      file.buffer,
      file.originalname,
    );
  }
}
