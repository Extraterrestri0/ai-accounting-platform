import type { DocumentType } from '../../domain/models';

export interface RecordPaymentDto {
  documentType: DocumentType;       // 'sales_invoice' | 'purchase_invoice'
  documentId: string;
  amount: string | number;          // exact decimal; validated ≤ outstanding
  paymentDate?: string;             // ISO date; defaults to today
  currency?: string;                // defaults to the document currency
  reference?: string;
  notes?: string;
}

export interface ReversePaymentDto {
  reason?: string;
}
