import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorLoginDto {
  /** Short-lived token returned when login requires 2FA. */
  @IsString()
  twoFactorToken: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}
