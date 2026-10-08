/**
 * Receivables & Payables domain types (Task 3.1).
 *
 * Money is carried as exact-decimal STRINGS at the persistence/API boundary and as
 * numbers inside the pure aging math (computed, then rounded to 2dp). Never float-store.
 */

export type PaymentType = 'inbound' | 'outbound';
export type DocumentType = 'sales_invoice' | 'purchase_invoice';
export type PaymentStatus = 'active' | 'reversed';

/** The five Bulgarian-standard aging buckets used by AR/AP aging reports. */
export type AgingBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface Payment {
  id: string;
  paymentType: PaymentType;
  documentType: DocumentType;
  documentId: string;
  counterpartyId?: string;
  counterpartyName?: string;
  amount: string;          // exact decimal
  currency: string;
  paymentDate: string;     // ISO date
  reference?: string;
  notes?: string;
  status: PaymentStatus;
  journalEntryId?: string;
  reversedByPaymentId?: string;
  createdBy: string;
  createdAt: string;
}

/** A single open AR/AP item (one source document + its settlement state). */
export interface OpenItem {
  documentType: DocumentType;
  documentId: string;
  documentRef?: string;        // human number (invoice no / entry no)
  counterpartyId?: string;
  counterpartyName?: string;
  issueDate?: string;          // ISO
  dueDate?: string;            // ISO (AP falls back to posting date)
  currency: string;
  total: string;               // gross document total (exact decimal)
  paid: string;                // Σ active payments (exact decimal)
  outstanding: string;         // total − paid (exact decimal, > 0 for open items)
  overdueDays: number;         // 0 when not yet due
  bucket: AgingBucketKey;
}

export interface ArApSummary {
  current: string;             // outstanding not yet overdue
  overdue: string;             // outstanding past due
  total: string;               // total outstanding
  count: number;               // number of open documents
  overdueCount: number;
}

export interface AgingBucketRow {
  key: AgingBucketKey;
  label: string;               // e.g. "1–30"
  amount: string;
  count: number;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucketRow[];
  total: string;
  items: OpenItem[];
}

export const AGING_BUCKETS: { key: AgingBucketKey; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'd1_30', label: '1–30' },
  { key: 'd31_60', label: '31–60' },
  { key: 'd61_90', label: '61–90' },
  { key: 'd90_plus', label: '90+' },
];
