import { Injectable, Logger } from '@nestjs/common';
import type { OtpMessage, OtpSender } from './otp-sender.interface';

export const EMAIL_OTP_SENDER = 'EMAIL_OTP_SENDER';

/**
 * Dev-ready email OTP sender. Logs the code to the console — replace with
 * a real provider (Resend/SendGrid/Nodemailer) by providing the same token.
 */
@Injectable()
export class EmailOtpSender implements OtpSender {
  private readonly logger = new Logger(EmailOtpSender.name);

  async send(message: OtpMessage): Promise<void> {
    this.logger.log(
      `[email] OTP for ${message.recipient}: ${message.code} (expires in 5 min)`,
    );
  }
}
