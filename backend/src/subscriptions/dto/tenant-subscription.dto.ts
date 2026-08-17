import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTenantSubscriptionDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ChangePlanDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ExtendSubscriptionDto {
  @IsDateString()
  endDate!: string;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateInvitationDto {
  @IsUUID()
  tenantId!: string;

  @IsString()
  @MaxLength(255)
  email!: string;
}

export class VerifyInvitationDto {
  @IsString()
  code!: string;

  @IsUUID()
  tenantId!: string;
}
