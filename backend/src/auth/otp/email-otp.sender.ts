import { Injectable, Logger } from '@nestjs/common';
import { GlobalSettingsService } from '../../settings/global-settings.service';
import { EmailService, type SmtpConfig } from '../../notifications/email.service';
import type { OtpMessage, OtpSender } from './otp-sender.interface';

export const EMAIL_OTP_SENDER = 'EMAIL_OTP_SENDER';

@Injectable()
export class EmailOtpSender implements OtpSender {
  private readonly logger = new Logger(EmailOtpSender.name);

  constructor(
    private readonly settings: GlobalSettingsService,
    private readonly emailService: EmailService,
  ) {}

  async send(message: OtpMessage): Promise<void> {
    const host = await this.settings.getValue('smtp.host');
    const port = await this.settings.getValue('smtp.port');
    const secure = await this.settings.getValue('smtp.secure');
    const username = await this.settings.getValue('smtp.username');
    const password = await this.settings.getValue('smtp.password');
    const fromEmail = await this.settings.getValue('smtp.fromEmail');
    const fromName = await this.settings.getValue('smtp.fromName');

    if (!host || !username || !password || !fromEmail) {
      this.logger.warn(
        'SMTP not configured — OTP not sent. Set SMTP in Settings → Notifications.',
      );
      return;
    }

    const config: SmtpConfig = {
      host,
      port: Number(port) || 587,
      secure: secure === 'true',
      username,
      password,
      fromEmail,
      fromName: fromName || 'MST-VTS',
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #1a1a2e; font-size: 20px; margin-bottom: 8px;">Your Verification Code</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Use the code below to complete your sign-in. This code expires in 5 minutes.
        </p>
        <div style="background: #f4f4f8; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a1a2e; font-family: monospace;">${message.code}</span>
        </div>
        <p style="color: #999; font-size: 12px; line-height: 1.5;">
          If you did not request this code, please ignore this email or contact support if you have concerns.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 11px;">MST-VTS Fleet Management</p>
      </div>
    `;

    const text = `Your verification code is: ${message.code}\n\nThis code expires in 5 minutes.\nIf you did not request this code, please ignore this email.`;

    try {
      await this.emailService.send(
        [message.recipient],
        'Your MST-VTS Verification Code',
        html,
        config,
        { text },
      );
      this.logger.log(`OTP sent to ${message.recipient}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP to ${message.recipient}`, err);
    }
  }
}
