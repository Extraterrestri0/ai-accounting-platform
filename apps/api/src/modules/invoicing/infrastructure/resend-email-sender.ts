import { Injectable, Logger } from '@nestjs/common';
import type { EmailSendResult, InvoiceEmailSender } from '../application/email.port';

/** Production email sender via Resend HTTP API (RESEND_API_KEY). */
@Injectable()
export class ResendEmailSender implements InvoiceEmailSender {
  private readonly log = new Logger('ResendEmail');
  private readonly from = process.env.MAIL_FROM ?? 'no-reply@example.com';
  async send(input: { to: string; subject: string; pdfStorageKey: string }): Promise<EmailSendResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: input.to, subject: input.subject, text: `Invoice reference: ${input.pdfStorageKey}` }) });
      if (!res.ok) return { providerMessageId: '', status: 'failed', error: `Resend ${res.status}` };
      const data = (await res.json()) as { id?: string };
      return { providerMessageId: data.id ?? '', status: 'sent' };
    } catch (e) { this.log.error(`Resend failed: ${(e as Error).message}`); return { providerMessageId: '', status: 'failed', error: (e as Error).message }; }
  }
}
