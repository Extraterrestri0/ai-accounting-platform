/** Invoicing domain models (standard sales invoice, MVP). */
export type InvoiceStatus = 'draft' | 'issued';
export type EmailStatus = 'queued' | 'sent' | 'failed' | 'delivered';

export interface InvoiceLineInput { description: string; quantity: string; unitPrice: string; vatCodeId?: string; vatRate: string; }
export interface InvoiceLine extends InvoiceLineInput { id: string; lineNo: number; netAmount: string; vatAmount: string; grossAmount: string; }
export interface InvoiceTotals { net: string; vat: string; gross: string; }

export interface Invoice {
  id: string; status: InvoiceStatus; customerId?: string; customerName?: string;
  seriesCode: string; seriesYear?: number; invoiceNumber?: string; issueDate?: string; dueDate?: string;
  currency: string; netTotal: string; vatTotal: string; grossTotal: string; notes?: string;
  journalEntryId?: string; issuedBy?: string; issuedAt?: string; createdAt: string; lines: InvoiceLine[];
}
export interface CreateDraftInput { customerId?: string; customerName?: string; seriesCode?: string; currency?: string; dueDate?: string; notes?: string; lines: InvoiceLineInput[]; }
export interface PdfArtifact { id: string; storageKey: string; checksum?: string; generatedAt: string; }
export interface EmailDelivery { id: string; toEmail: string; status: EmailStatus; providerMessageId?: string; error?: string; queuedAt: string; sentAt?: string; }
