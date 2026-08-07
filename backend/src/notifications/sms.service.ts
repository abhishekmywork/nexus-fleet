import { Injectable, Logger } from '@nestjs/common';

export interface SmsConfig {
  apiKey: string;
  senderId: string;
  type: string; // 'transactional' | 'promotional'
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const SPRINGEDGE_API_URL = 'https://api.springedge.com/v1/sms/send';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(
    to: string[],
    message: string,
    config: SmsConfig,
  ): Promise<SmsResult> {
    if (to.length === 0) {
      return { success: true };
    }

    // SpringEdge accepts comma-separated numbers
    const recipient = to.join(',');

    try {
      const response = await fetch(SPRINGEDGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          to: recipient,
          sender_id: config.senderId,
          message,
          type: config.type,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const body = await response.json() as Record<string, any>;

      if (!response.ok) {
        const errMsg =
          body?.error?.message || body?.message || `HTTP ${response.status}`;
        this.logger.error(`SpringEdge SMS failed: ${errMsg}`);
        return { success: false, error: errMsg };
      }

      return {
        success: true,
        messageId: body.message_id,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`SpringEdge SMS request failed: ${msg}`);
      return { success: false, error: msg };
    }
  }
}
