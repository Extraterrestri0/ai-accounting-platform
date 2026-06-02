export interface EmailSendResult { providerMessageId: string; status: 'sent' | 'queued' | 'failed'; error?: string; }
/** Email delivery abstraction. Prod = EU email provider; dev = logging adapter. */
export interface InvoiceEmailSender { send(input: { to: string; subject: string; pdfStorageKey: string }): Promise<EmailSendResult>; }
export const INVOICE_EMAIL_SENDER = Symbol('Invoicing.EmailSender');
