import type { InvoiceLineInput } from '../../domain/invoice/models';
export interface CreateInvoiceDto { customerId?: string; customerName?: string; seriesCode?: string; currency?: string; dueDate?: string; notes?: string; lines: InvoiceLineInput[]; }
export interface SendEmailDto { toEmail: string; }
