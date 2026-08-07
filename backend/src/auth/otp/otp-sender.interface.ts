import type { TwoFactorMethod } from '../../users/user.entity';

export interface OtpMessage {
  recipient: string;
  code: string;
  method: TwoFactorMethod;
}

/**
 * Abstraction over OTP delivery. Implementations can swap in real
 * providers (Twilio for SMS, SendGrid/Resend for email) without touching
 * the OTP flow itself.
 */
export interface OtpSender {
  send(message: OtpMessage): Promise<void>;
}
