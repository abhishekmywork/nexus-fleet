import { Injectable, Logger } from '@nestjs/common';
import type { OtpMessage, OtpSender } from './otp-sender.interface';

export const SMS_OTP_SENDER = 'SMS_OTP_SENDER';

/**
 * Dev-ready SMS OTP sender. Logs the code to the console — replace with a
 * real provider (Twilio/Vonage) by providing the same token.
 */
@Injectable()
export class SmsOtpSender implements OtpSender {
  private readonly logger = new Logger(SmsOtpSender.name);

  async send(message: OtpMessage): Promise<void> {
    this.logger.log(
      `[sms] OTP to ${message.recipient}: ${message.code} (expires in 5 min)`,
    );
  }
}
