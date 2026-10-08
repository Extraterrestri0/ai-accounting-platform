import type { ApplicationService } from '../../../shared-kernel';
import type { CreateDraftInput, EmailDelivery, Invoice, RelatedDocument } from '../domain/invoice/models';

export interface IssueResult { invoice: Invoice; journalEntryId?: string; }
export interface RelatedDocuments { document: RelatedDocument; related: RelatedDocument[]; }

/** PUBLIC invoicing service. Issue/send/post are HUMAN-only (AI cannot issue/send/post). */
export interface IInvoiceService extends ApplicationService {
  createDraft(input: CreateDraftInput): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  listInvoices(status?: 'draft' | 'issued', page?: number, pageSize?: number): Promise<Invoice[]>;
  validateInvoice(invoiceId: string): Promise<{ ok: boolean; errors: string[] }>;
  /** Draft → issue (gapless per-kind number) → PDF → kind-aware ledger posting → sales VAT register. */
  issueInvoice(invoiceId: string): Promise<IssueResult>;
  /** Credit note (reverses) from an issued invoice/debit note. */
  createCreditNote(invoiceId: string): Promise<Invoice>;
  /** Debit note (increases) from an issued invoice/debit note. */
  createDebitNote(invoiceId: string): Promise<Invoice>;
  /** Copy a proforma into a new invoice draft. */
  convertProformaToInvoice(proformaId: string): Promise<Invoice>;
  /** The document + its source + documents derived from it. */
  getRelatedDocuments(invoiceId: string): Promise<RelatedDocuments>;
  sendInvoiceEmail(invoiceId: string, toEmail: string): Promise<EmailDelivery>;
  listEmailDeliveries(invoiceId: string): Promise<EmailDelivery[]>;
}
export const INVOICE_SERVICE = Symbol('Invoicing.InvoiceService');
