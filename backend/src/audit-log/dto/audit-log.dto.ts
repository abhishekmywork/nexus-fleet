import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const ENTITY_TYPES = [
  'vehicle',
  'vehicle_serving_area',
  'vehicle_driver',
  'vehicle_gps_device',
  'tenant',
  'user',
  'role',
  'serving_area',
  'geofence',
  'event_rule',
  'setting',
] as const;

const ACTIONS = [
  'assigned',
  'unassigned',
  'soft_deleted',
  'restored',
  'permanently_deleted',
  'created',
  'updated',
  'deleted',
] as const;

export class CreateAuditLogDto {
  @IsIn(ACTIONS)
  action!: string;

  @IsIn(ENTITY_TYPES)
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
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
