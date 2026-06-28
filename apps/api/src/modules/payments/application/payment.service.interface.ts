import type { ApplicationService } from '../../../shared-kernel';
import type { DocumentType, Payment } from '../domain/models';

export interface RecordPaymentInput {
  documentType: DocumentType;
  documentId: string;
  amount: string | number;     // exact decimal; validated ≤ outstanding (overpayment-protected)
  paymentDate?: string;        // ISO date; defaults to today
  currency?: string;           // defaults to the document currency
  reference?: string;
  notes?: string;
}

export interface OutstandingBalance {
  documentType: DocumentType;
  documentId: string;
  currency: string;
  total: string;
  paid: string;
  outstanding: string;
  settled: boolean;
}

/**
 * PUBLIC payment service. Recording a payment posts a balanced SETTLEMENT entry to
 * the immutable ledger via the ledger service (human-only — Inv. 4/5), using the
 * configurable account mapping (cash_bank / receivable / payable — never hardcoded).
 * Reversal = a ledger reversing entry; the payment row is flagged, never deleted.
 */
export interface IPaymentService extends ApplicationService {
  recordPayment(input: RecordPaymentInput): Promise<Payment>;
  reversePayment(paymentId: string, reason: string): Promise<Payment>;
  calculateOutstandingBalance(documentType: DocumentType, documentId: string): Promise<OutstandingBalance>;
  calculateOverdueDays(documentType: DocumentType, documentId: string, asOf?: string): Promise<number>;
  getPayment(paymentId: string): Promise<Payment | null>;
  listPayments(filters: { documentType?: DocumentType; documentId?: string; counterpartyId?: string }, page?: number, pageSize?: number): Promise<Payment[]>;
}
export const PAYMENT_SERVICE = Symbol('Payments.PaymentService');
