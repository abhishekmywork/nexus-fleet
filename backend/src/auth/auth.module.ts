import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { Tenant } from '../tenants/tenant.entity';
import { RefreshToken } from './refresh-token.entity';
import { TwoFactorOtp } from './two-factor-otp.entity';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp/otp.service';
import {
  EMAIL_OTP_SENDER,
  EmailOtpSender,
} from './otp/email-otp.sender';
import { SMS_OTP_SENDER, SmsOtpSender } from './otp/sms-otp.sender';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../notifications/sms.service';
import type { AppConfig } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Tenant,
      RefreshToken,
      TwoFactorOtp,
    ]),
    UsersModule,
    SettingsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt.accessSecret', { infer: true }),
        signOptions: {
          expiresIn: config.get('jwt.accessExpiresIn', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController, TwoFactorController],
  providers: [
    AuthService,
    TwoFactorService,
    JwtStrategy,
    OtpService,
    EmailService,
    SmsService,
    { provide: EMAIL_OTP_SENDER, useClass: EmailOtpSender },
    { provide: SMS_OTP_SENDER, useClass: SmsOtpSender },
  ],
})
export class AuthModule {}
