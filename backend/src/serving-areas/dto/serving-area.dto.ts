import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateServingAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateServingAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
