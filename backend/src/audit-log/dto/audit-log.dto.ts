import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @IsIn(['assigned', 'unassigned'])
  action!: string;

  @IsIn(['vehicle_serving_area', 'vehicle_driver', 'vehicle_gps_device'])
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @IsUUID()
  relatedId!: string;

  @IsString()
  relatedName!: string;

  @IsOptional()
  @IsString()
  entityName?: string | null;
}

export class AuditLogQueryDto {
  @IsOptional()
  @IsIn(['vehicle_serving_area', 'vehicle_driver', 'vehicle_gps_device'])
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}
