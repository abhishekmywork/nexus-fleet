import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantResolverMiddleware } from '../common/middleware/tenant-resolver.middleware';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { GeofenceService, CreateGeofenceDto } from './geofence.service';

@Controller('geofences')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Public()
  @Get('public/by-tenant')
  async findPublicByTenant(@Req() req: Request) {
    const slug =
      (req.headers['x-tenant-slug'] as string) ||
      TenantResolverMiddleware.extractSubdomain(req.headers.host ?? '');
    if (!slug) return [];
    return this.geofenceService.findPublicBySlug(slug);
  }

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
