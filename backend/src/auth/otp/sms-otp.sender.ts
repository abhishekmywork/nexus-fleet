import { Injectable, Logger } from '@nestjs/common';
import { GlobalSettingsService } from '../../settings/global-settings.service';
import { SmsService } from '../../notifications/sms.service';
import type { OtpMessage, OtpSender } from './otp-sender.interface';

export const SMS_OTP_SENDER = 'SMS_OTP_SENDER';

@Injectable()
export class SmsOtpSender implements OtpSender {
  private readonly logger = new Logger(SmsOtpSender.name);

  constructor(
    private readonly settings: GlobalSettingsService,
    private readonly smsService: SmsService,
  ) {}

  async send(message: OtpMessage): Promise<void> {
    const apiKey = await this.settings.getValue('sms.apiKey');
    const senderId = await this.settings.getValue('sms.senderId');
    const type = await this.settings.getValue('sms.type');

    if (!apiKey || !senderId) {
      this.logger.warn(
        'SMS not configured — OTP not sent. Set SMS in Settings → Notifications.',
      );
      return;
    }

    try {
      await this.smsService.send(
        [message.recipient],
        `Your MST-VTS verification code is: ${message.code}. It expires in 5 minutes.`,
        { apiKey, senderId, type: type || 'transactional' },
      );
      this.logger.log(`SMS OTP sent to ${message.recipient}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS OTP to ${message.recipient}`, err);
    }
  }
}
