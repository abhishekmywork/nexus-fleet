import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGPSDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  imei!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  simNo?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

export class UpdateGPSDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  imei?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  simNo?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
