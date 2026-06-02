import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EmailSendResult, InvoiceEmailSender } from '../application/email.port';

/** DEV email adapter — logs and reports 'sent'. Prod = an EU email provider with delivery webhooks. */
@Injectable()
export class LogEmailSender implements InvoiceEmailSender {
  private readonly log = new Logger('InvoiceEmail');
  async send(input: { to: string; subject: string; pdfStorageKey: string }): Promise<EmailSendResult> {
    this.log.log(`sending "${input.subject}" to ${input.to} (${input.pdfStorageKey})`);
    return { providerMessageId: randomUUID(), status: 'sent' };
  }
}
