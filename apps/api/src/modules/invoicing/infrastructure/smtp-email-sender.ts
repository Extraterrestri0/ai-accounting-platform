import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailSendResult, InvoiceEmailSender } from '../application/email.port';

/** Production SMTP email sender (nodemailer). Configured via SMTP_* env. */
@Injectable()
export class SmtpEmailSender implements InvoiceEmailSender {
  private readonly log = new Logger('SmtpEmail');
  private readonly from = process.env.MAIL_FROM ?? 'no-reply@example.com';
  private transport(): Transporter {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
    });
  }
  async send(input: { to: string; subject: string; pdfStorageKey: string }): Promise<EmailSendResult> {
    try {
      const info = await this.transport().sendMail({ from: this.from, to: input.to, subject: input.subject,
        text: `Your invoice is attached. Reference: ${input.pdfStorageKey}` });
      return { providerMessageId: info.messageId, status: 'sent' };
    } catch (e) { this.log.error(`SMTP send failed: ${(e as Error).message}`); return { providerMessageId: '', status: 'failed', error: (e as Error).message }; }
  }
}
