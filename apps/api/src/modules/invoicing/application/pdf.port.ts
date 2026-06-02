import type { Invoice } from '../domain/invoice/models';
export interface GeneratedPdf { storageKey: string; checksum: string; bytes: number; }
/** PDF generation abstraction. Prod = a real renderer; dev = a deterministic placeholder. */
export interface InvoicePdfGenerator { generate(invoice: Invoice): Promise<GeneratedPdf>; }
export const INVOICE_PDF_GENERATOR = Symbol('Invoicing.PdfGenerator');
