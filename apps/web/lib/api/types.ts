/** Shared API response shapes (mirror apps/api contracts). */

export interface Company {
  id: string;
  tenantId?: string;
  name: string;
  eik?: string | null;
  vatStatus?: string;
  baseCurrency: string;
  fiscalYearStartMonth?: number;
  status?: string;
  createdAt?: string;
}

export interface LoginResult {
  status: 'authenticated' | 'mfa_required';
  accessToken?: string;
  refreshToken?: string;
  mfaToken?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type DocumentStatus =
  | 'uploaded' | 'scanning' | 'clean' | 'infected' | 'extracting'
  | 'extracted' | 'reviewing' | 'posted' | 'rejected' | string;

export interface DocumentRow {
  id: string;
  filename?: string;
  originalFilename?: string;
  mimeType?: string;
  status: DocumentStatus;
  detectedType?: string | null;
  sizeBytes?: number;
  createdAt?: string;
  counterparty?: string | null;
}

// --- Receivables & Payables (Task 3.1) ---
export type ArApDocumentType = 'sales_invoice' | 'purchase_invoice';
export type AgingBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

/** One open AR/AP item (a source document + its settlement state). */
export interface OpenItem {
  documentType: ArApDocumentType;
  documentId: string;
  documentRef?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  total: string;
  paid: string;
  outstanding: string;
  overdueDays: number;
  bucket: AgingBucketKey;
}

export interface ArApSummary {
  current: string;
  overdue: string;
  total: string;
  count: number;
  overdueCount: number;
}

export interface AgingBucketRow {
  key: AgingBucketKey;
  label: string;
  amount: string;
  count: number;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucketRow[];
  total: string;
  items: OpenItem[];
}

export interface PaymentRow {
  id: string;
  paymentType: 'inbound' | 'outbound';
  documentType: ArApDocumentType;
  documentId: string;
  counterpartyId?: string;
  counterpartyName?: string;
  amount: string;
  currency: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  status: 'active' | 'reversed';
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
}

export interface RecordPaymentBody {
  documentType: ArApDocumentType;
  documentId: string;
  amount: string | number;
  paymentDate?: string;
  currency?: string;
  reference?: string;
  notes?: string;
}

// --- Audit trail (Task 4.1) ---
export type AuditActorType = 'user' | 'ai' | 'system';

export interface AuditEvent {
  id: string;
  seq: number;
  companyId?: string;
  actorType: AuditActorType;
  actorId?: string;
  actorEmail?: string;
  action: string;
  category: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  occurredAt: string;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditSummary {
  total: number;
  distinctActors: number;
  byActorType: { actorType: string; count: number }[];
  byCategory: { category: string; count: number }[];
  firstAt?: string;
  lastAt?: string;
}

export type AuditChainStatus = 'verified' | 'warning' | 'failed';
export interface AuditVerification {
  status: AuditChainStatus;
  ok: boolean;
  events: number;
  checkedAt: string;
}

export interface AuditFilterParams {
  actorType?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// --- Banking & Reconciliation (Task 3.2) ---
export type BankTransactionType = 'inbound' | 'outbound';
export type ReconciliationStatus = 'unreconciled' | 'reconciled' | 'ignored';
export type BankMatchDocumentType = 'sales_invoice' | 'purchase_invoice';

export interface BankAccount {
  id: string; iban: string; bic?: string; bankName?: string; currency: string;
  isPrimary: boolean; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface BankStatement {
  id: string; bankAccountId: string; fileName: string; importedBy?: string; importedAt: string;
  statementFrom?: string; statementTo?: string; rowCount: number; duplicateCount: number; errorCount: number;
}
export interface BankTransaction {
  id: string; bankStatementId: string; bankAccountId: string; bookingDate: string; valueDate?: string;
  amount: string; currency: string; description?: string; counterpartyName?: string; counterpartyIban?: string;
  reference?: string; transactionType: BankTransactionType; reconciliationStatus: ReconciliationStatus;
  matchedPaymentId?: string; createdAt: string;
}
export interface BankRowError { row: number; field?: string; message: string; }
export interface ImportReport {
  statementId: string; fileName: string; format: string; rowCount: number; importedCount: number;
  duplicateCount: number; errorCount: number; errors: BankRowError[]; statementFrom?: string; statementTo?: string;
}
export interface MatchSuggestion {
  documentType: BankMatchDocumentType; documentId: string; documentRef?: string; counterpartyName?: string;
  outstanding: string; currency: string; dueDate?: string; suggestedAmount: string; confidence: number; rule: string; reason: string;
}
export interface BankingSummary {
  totalTransactions: number; unreconciled: number; reconciled: number; ignored: number;
  lastImportAt?: string; accountCount: number;
}

// --- Management reports (Revenue/Expenses by Month, Cash Flow) ---
export interface MonthlyAmount { month: number; amount: string; }
export interface MonthlySeries { year: number; currency: string; months: MonthlyAmount[]; total: string; average: string; }
export interface CashFlowMonth { month: number; inflow: string; outflow: string; net: string; }
export interface CashFlowReport {
  year: number; currency: string; accountCode: string;
  months: CashFlowMonth[]; totalInflow: string; totalOutflow: string; netCashFlow: string;
}

// --- VIES validation (Task 4.2) ---
export type ViesStatusKind = 'valid' | 'invalid' | 'unchecked';
export interface ViesStatus {
  counterpartyId: string;
  vatNumber?: string;
  countryCode?: string;
  status: ViesStatusKind;
  valid?: boolean;
  name?: string;
  checkedAt?: string;
  expiresAt?: string;
  stale: boolean;
}
export interface ViesValidationResult {
  vatNumber: string;
  countryCode: string;
  valid: boolean;
  source: 'cache' | 'live' | 'vendor' | 'format';
  fromCache: boolean;
  name?: string;
  address?: string;
  checkedAt: string;
  expiresAt: string;
}
export interface ViesDatasetRow {
  counterpartyId?: string;
  counterpartyName: string;
  vatNumber: string;
  countryCode: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: string;
  currency: string;
}
export interface ViesDataset {
  year: number;
  month: number;
  rows: ViesDatasetRow[];
  totalTaxable: string;
  count: number;
}

// --- Accounting periods (Task 4.3) ---
export type PeriodStatus = 'open' | 'locked';
export interface AccountingPeriod {
  id?: string;
  year: number;
  month: number;
  key: string;
  status: PeriodStatus;
  lockedBy?: string;
  lockedByEmail?: string;
  lockedAt?: string;
  isCurrent: boolean;
}
