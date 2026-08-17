import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @IsIn(['assigned', 'unassigned', 'soft_deleted', 'restored', 'permanently_deleted', 'created', 'updated'])
  action!: string;

  @IsIn(['vehicle_serving_area', 'vehicle_driver', 'vehicle_gps_device', 'vehicle'])
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @IsOptional()
  @IsUUID()
  relatedId?: string;

  @IsOptional()
  @IsString()
  relatedName?: string;

  @IsOptional()
  @IsString()
  entityName?: string | null;
}

export class AuditLogQueryDto {
  @IsOptional()
  @IsIn(['vehicle_serving_area', 'vehicle_driver', 'vehicle_gps_device', 'vehicle'])
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}
