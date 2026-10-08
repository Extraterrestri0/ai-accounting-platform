/** Invoicing domain models (sales documents). */
export type InvoiceStatus = 'draft' | 'issued';
export type EmailStatus = 'queued' | 'sent' | 'failed' | 'delivered';
export type DocumentKind = 'invoice' | 'credit_note' | 'debit_note' | 'proforma';

export interface InvoiceLineInput { description: string; quantity: string; unitPrice: string; vatCodeId?: string; vatRate: string; catalogItemId?: string; }
export interface InvoiceLine extends InvoiceLineInput { id: string; lineNo: number; unit?: string; saftCode?: string; netAmount: string; vatAmount: string; grossAmount: string; }
export interface InvoiceTotals { net: string; vat: string; gross: string; }

export interface Invoice {
  id: string; documentKind: DocumentKind; status: InvoiceStatus; customerId?: string; customerName?: string;
  referencesInvoiceId?: string;
  seriesCode: string; seriesYear?: number; invoiceNumber?: string; issueDate?: string; dueDate?: string;
  currency: string; netTotal: string; vatTotal: string; grossTotal: string; notes?: string;
  journalEntryId?: string; issuedBy?: string; issuedAt?: string; createdAt: string; lines: InvoiceLine[];
}
export interface CreateDraftInput { documentKind?: DocumentKind; referencesInvoiceId?: string; customerId?: string; customerName?: string; seriesCode?: string; currency?: string; dueDate?: string; notes?: string; lines: InvoiceLineInput[]; }
/** A document related to another (its source, or documents derived from it). */
export interface RelatedDocument { id: string; documentKind: DocumentKind; status: InvoiceStatus; invoiceNumber?: string; grossTotal: string; createdAt: string; relation: 'self' | 'source' | 'derived'; }
export interface PdfArtifact { id: string; storageKey: string; checksum?: string; generatedAt: string; }
export interface EmailDelivery { id: string; toEmail: string; status: EmailStatus; providerMessageId?: string; error?: string; queuedAt: string; sentAt?: string; }
