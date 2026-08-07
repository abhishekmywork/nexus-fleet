import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as crypto from 'node:crypto';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly encryptionKey: Buffer | null;

  constructor() {
    const keyHex = process.env.NOTIFICATION_ENCRYPTION_KEY;
    if (keyHex && keyHex.length === 64) {
      this.encryptionKey = Buffer.from(keyHex, 'hex');
    } else {
      this.encryptionKey = null;
      if (keyHex) {
        this.logger.warn(
          'NOTIFICATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Storing passwords in plaintext.',
        );
      }
    }
  }

  encrypt(plain: string): string {
    if (!this.encryptionKey) return plain;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(cipherText: string): string {
    if (!this.encryptionKey) return cipherText;
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(tag);
      return (
        decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
      );
    } catch {
      this.logger.warn('Failed to decrypt SMTP password, returning as-is');
      return cipherText;
    }
  }

  async send(
    to: string[],
    subject: string,
    html: string,
    config: SmtpConfig,
  ): Promise<void> {
    if (to.length === 0) return;

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: this.decrypt(config.password),
      },
      connectionTimeout: 30_000,
      greetingTimeout: 10_000,
      tls: {
        rejectUnauthorized: true,
      },
      logger: true,
    } as any);

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to.join(', '),
      subject,
      html,
    });
  }

  async testConnection(config: SmtpConfig): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: this.decrypt(config.password),
        },
        connectionTimeout: 30_000,
        tls: { rejectUnauthorized: true },
        family: 4,
      } as any);
      await transporter.verify();
      return true;
    } catch (err) {
      this.logger.error('SMTP connection test failed', err);
      return false;
    }
  }
}
