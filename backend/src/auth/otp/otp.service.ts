import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TwoFactorOtp } from '../two-factor-otp.entity';
import { User, type TwoFactorMethod } from '../../users/user.entity';
import type { AppConfig } from '../../config/configuration';
import { EMAIL_OTP_SENDER, EmailOtpSender } from './email-otp.sender';
import { SMS_OTP_SENDER, SmsOtpSender } from './sms-otp.sender';
import type { OtpSender } from './otp-sender.interface';

const MAX_ATTEMPTS = 5;

/**
 * Generates, persists, sends and verifies one-time passcodes for 2FA.
 * Codes are 6 digits, single-use, and expire after a configurable window.
 */
@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(TwoFactorOtp)
    private readonly otps: Repository<TwoFactorOtp>,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(EMAIL_OTP_SENDER) private readonly emailSender: EmailOtpSender,
    @Inject(SMS_OTP_SENDER) private readonly smsSender: SmsOtpSender,
  ) {}

  async generateAndSend(
    user: User,
    method: TwoFactorMethod,
  ): Promise<{ sentTo: string; devCode?: string }> {
    const recipient = method === 'email' ? user.email : user.phone;
    if (!recipient) {
      throw new BadRequestException(
        `No ${method === 'email' ? 'email' : 'phone'} on file for this account`,
      );
    }

    await this.assertNotCoolingDown(user.id, method);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(
      Date.now() + this.config.get('otp.expiresInSeconds', { infer: true }) * 1000,
    );
    await this.otps.save(
      this.otps.create({ userId: user.id, code, method, expiresAt }),
    );

    const sender: OtpSender =
      method === 'email' ? this.emailSender : this.smsSender;
    await sender.send({ recipient, code, method });

    return {
      sentTo: this.mask(recipient),
      devCode: this.config.get('isDev', { infer: true }) ? code : undefined,
    };
  }

  /** Verifies (and consumes) the latest unconsumed code for a user. */
  async verify(userId: string, method: TwoFactorMethod, code: string): Promise<boolean> {
    const otp = await this.otps.findOne({
      where: { userId, method, consumed: false },
      order: { createdAt: 'DESC' },
    });
    if (!otp) return false;
    if (otp.expiresAt < new Date()) return false;
    if (otp.attempts >= MAX_ATTEMPTS) {
      await this.otps.remove(otp);
      return false;
    }
    if (otp.code !== code) {
      otp.attempts += 1;
      await this.otps.save(otp);
      return false;
    }
    otp.consumed = true;
    await this.otps.save(otp);
    return true;
  }

  /** Returns the latest pending (unconsumed) OTP for a user, if any. */
  async findLatest(userId: string): Promise<TwoFactorOtp | null> {
    const otp = await this.otps.findOne({
      where: { userId, consumed: false },
      order: { createdAt: 'DESC' },
    });
    if (otp && otp.expiresAt >= new Date()) return otp;
    return null;
  }

  private async assertNotCoolingDown(userId: string, method: TwoFactorMethod) {
    const last = await this.otps.findOne({
      where: { userId, method },
      order: { createdAt: 'DESC' },
    });
    if (!last) return;
    const cooldownMs =
      this.config.get('otp.resendCooldownSeconds', { infer: true }) * 1000;
    if (Date.now() - last.createdAt.getTime() < cooldownMs) {
      const remaining = Math.ceil(
        (cooldownMs - (Date.now() - last.createdAt.getTime())) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${remaining}s before requesting a new code`,
      );
    }
  }

  private mask(value: string): string {
    if (value.length <= 4) return value;
    if (value.includes('@')) {
      const [local, domain] = value.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    }
    return `${value.slice(0, 3)}***${value.slice(-2)}`;
  }
}
