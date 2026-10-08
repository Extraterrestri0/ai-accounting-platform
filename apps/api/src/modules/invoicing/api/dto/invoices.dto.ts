import type { DocumentKind, InvoiceLineInput } from '../../domain/invoice/models';
export interface CreateInvoiceDto { documentKind?: DocumentKind; customerId?: string; customerName?: string; seriesCode?: string; currency?: string; dueDate?: string; notes?: string; lines: InvoiceLineInput[]; }
export interface SendEmailDto { toEmail: string; }
