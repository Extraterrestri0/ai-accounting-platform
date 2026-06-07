/** SAF-T v1 normalized dataset shape (structured, XML-ready — not the final XML). */

export interface SaftHeader {
  companyName: string;
  eik?: string;
  vatNumber?: string;
  period: { year: number; month: number; from: string; to: string };
  currency: string;
  softwareName: string;
  softwareVersion: string;
  generatedAt: string;
}

// ---- Master files ----
export interface SaftParty {
  id: string; name: string; eik?: string; vatNumber?: string;
  address?: string; city?: string; country: string; saftCode?: string;
}
export interface SaftProduct { code: string; description: string; unit: string; vatRate: string; kind: string; saftCode?: string; }
export interface SaftAccount { accountCode: string; accountName: string; accountType: string; parentAccountCode?: string; saftCode?: string; }
export interface SaftTaxCode { vatCode: string; vatRate: string; vatTreatment: string; direction: string; saftTaxCode?: string; }
export interface SaftMasterFiles {
  customers: SaftParty[]; suppliers: SaftParty[]; products: SaftProduct[]; accounts: SaftAccount[]; taxCodes: SaftTaxCode[];
}

// ---- General ledger ----
export interface SaftGlLine { lineNumber: number; accountCode: string; debit: string; credit: string; counterparty?: string; vatCode?: string; narrative?: string; }
export interface SaftGlEntry {
  journalEntryId: string; entryNo: number; postingDate: string; documentReference?: string; description?: string;
  sourceType: string; sourceId?: string; reversesEntryId?: string; lines: SaftGlLine[];
}

// ---- Source documents ----
export interface SaftSalesInvoice {
  invoiceNumber?: string; invoiceDate?: string; customer?: string; customerId?: string;
  netAmount: string; vatAmount: string; grossAmount: string; vatCode?: string; documentType: string;
}
export interface SaftPurchaseDocument {
  supplier?: string; supplierId?: string; documentNumber: string; documentDate?: string;
  netAmount: string; vatAmount: string; grossAmount: string;
  classificationCategory?: string; accountingSuggestion?: string; approvalStatus?: string; journalEntryId?: string;
}
export interface SaftPaymentDocument {
  paymentDate: string; amount: string; direction: 'inbound' | 'outbound'; counterparty?: string;
  linkedDocumentType?: string; linkedDocumentId?: string; bankReference?: string; reconciliationStatus?: string;
}
export interface SaftSourceDocuments {
  salesInvoices: SaftSalesInvoice[]; purchaseDocuments: SaftPurchaseDocument[]; payments: SaftPaymentDocument[];
}

export interface SaftDatasetCounts {
  customers: number; suppliers: number; products: number; accounts: number; taxCodes: number;
  glEntries: number; salesInvoices: number; purchaseDocuments: number; payments: number;
}

export interface SaftDataset {
  header: SaftHeader;
  masterFiles: SaftMasterFiles;
  generalLedgerEntries: SaftGlEntry[];
  sourceDocuments: SaftSourceDocuments;
  counts: SaftDatasetCounts;
}

// ---- Validation ----
export type ValidationLevel = 'error' | 'warning' | 'info';
export interface ValidationIssue { level: ValidationLevel; code: string; message: string; count?: number; }
export interface ValidationSummary {
  ok: boolean;                 // true when there are no ERRORS (warnings/info do not block)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  counts: { errors: number; warnings: number; info: number };
}

// ---- Export record ----
export type SaftExportStatus = 'generated' | 'failed';
export interface SaftExportRecord {
  id: string; year: number; month: number; status: SaftExportStatus;
  generatedBy?: string; generatedAt: string; validationSummary?: ValidationSummary; error?: string;
}
