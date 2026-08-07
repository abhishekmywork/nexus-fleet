import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { OtpService } from './otp/otp.service';
import type { SetupTwoFactorDto } from './dto/two-factor.dto';

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Starts enabling 2FA: sends a code via the chosen method. The account is
   * only switched on once the code is verified.
   */
  async beginSetup(userId: string, dto: SetupTwoFactorDto) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    if (dto.method === 'sms' && !user.phone) {
      throw new BadRequestException(
        'Add a phone number to your profile before enabling SMS 2FA',
      );
    }
    const result = await this.otpService.generateAndSend(user, dto.method);
    return {
      method: dto.method,
      sentTo: result.sentTo,
      devCode: result.devCode,
      expiresInSeconds: 300,
    };
  }

  /** Confirms the setup code and enables 2FA for the account. */
  async completeSetup(userId: string, code: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const otp = await this.otpService.findLatest(user.id);
    if (!otp) {
      throw new BadRequestException('No pending verification. Request a new code first');
    }
    const ok = await this.otpService.verify(user.id, otp.method, code);
    if (!ok) {
      throw new BadRequestException('Invalid or expired code');
    }

    user.twoFactorEnabled = true;
    user.twoFactorMethod = otp.method;
    await this.users.save(user);
    return this.toDto(user);
  }

  /** Disables 2FA after verifying the current code. */
  async disable(userId: string, code: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const ok = await this.otpService.verify(user.id, user.twoFactorMethod!, code);
    if (!ok) {
      throw new BadRequestException('Invalid or expired code');
    }
    user.twoFactorEnabled = false;
    user.twoFactorMethod = null;
    await this.users.save(user);
    return this.toDto(user);
  }

  private toDto(user: User) {
    return {
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
    };
  }
}
