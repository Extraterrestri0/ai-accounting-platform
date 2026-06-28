export type TransactionType = 'inbound' | 'outbound';
export type ReconciliationStatus = 'unreconciled' | 'reconciled' | 'ignored';
export type StatementFormat = 'csv' | 'xlsx';
/** Document side a transaction reconciles against. Mirrors the Payments DocumentType. */
export type MatchDocumentType = 'sales_invoice' | 'purchase_invoice';

export interface BankAccount {
  id: string;
  iban: string;
  bic?: string;
  bankName?: string;
  currency: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  fileName: string;
  importedBy?: string;
  importedAt: string;
  statementFrom?: string;
  statementTo?: string;
  rowCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface BankTransaction {
  id: string;
  bankStatementId: string;
  bankAccountId: string;
  bookingDate: string;
  valueDate?: string;
  amount: string;            // signed exact decimal (+ inbound / − outbound)
  currency: string;
  description?: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  reference?: string;
  transactionType: TransactionType;
  reconciliationStatus: ReconciliationStatus;
  matchedPaymentId?: string;
  createdAt: string;
}

/** A raw row after format parsing — canonical header keys, raw string cells. */
export interface ParsedRow { [key: string]: string; }

/** A validated, normalized transaction row ready to persist. */
export interface NormalizedRow {
  bookingDate: string;       // YYYY-MM-DD
  valueDate?: string;
  amount: string;            // signed exact decimal
  currency: string;
  description?: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  reference?: string;
  transactionType: TransactionType;
}

export interface RowError { row: number; field?: string; message: string; }

export interface ImportReport {
  statementId: string;
  fileName: string;
  format: StatementFormat;
  rowCount: number;          // total data rows parsed
  importedCount: number;     // rows inserted
  duplicateCount: number;
  errorCount: number;
  errors: RowError[];
  statementFrom?: string;
  statementTo?: string;
}

/** A reconciliation match candidate against an AR/AP open item. */
export interface MatchSuggestion {
  documentType: MatchDocumentType;
  documentId: string;
  documentRef?: string;
  counterpartyName?: string;
  outstanding: string;
  currency: string;
  dueDate?: string;
  suggestedAmount: string;
  confidence: number;        // 0..1
  rule: string;              // machine rule id
  reason: string;            // user-facing (BG)
}

export interface BankingSummary {
  totalTransactions: number;
  unreconciled: number;
  reconciled: number;
  ignored: number;
  lastImportAt?: string;
  accountCount: number;
}
