import type { ApplicationService } from '../../../shared-kernel';
import type { CreateDraftInput, EmailDelivery, Invoice } from '../domain/invoice/models';

export interface IssueResult { invoice: Invoice; journalEntryId?: string; }

/** PUBLIC invoicing service. Issue/send/post are HUMAN-only (AI cannot issue/send/post). */
export interface IInvoiceService extends ApplicationService {
  createDraft(input: CreateDraftInput): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  listInvoices(status?: 'draft' | 'issued', page?: number, pageSize?: number): Promise<Invoice[]>;
  validateInvoice(invoiceId: string): Promise<{ ok: boolean; errors: string[] }>;
  /** Draft → issue (gapless number) → PDF → post to ledger → feed sales VAT register. */
  issueInvoice(invoiceId: string): Promise<IssueResult>;
  sendInvoiceEmail(invoiceId: string, toEmail: string): Promise<EmailDelivery>;
  listEmailDeliveries(invoiceId: string): Promise<EmailDelivery[]>;
}
export const INVOICE_SERVICE = Symbol('Invoicing.InvoiceService');
