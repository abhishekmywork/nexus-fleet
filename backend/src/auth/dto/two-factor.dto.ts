import { IsIn, IsString, Length } from 'class-validator';
import type { TwoFactorMethod } from '../../users/user.entity';

export class SetupTwoFactorDto {
  @IsIn(['email', 'sms'], { message: 'Method must be email or sms' })
  method: TwoFactorMethod;
}

export class VerifyTwoFactorSetupDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}
