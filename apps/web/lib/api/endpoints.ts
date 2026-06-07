'use client';

import { api, API_BASE, getToken, getActiveCompany, ApiError } from './client';
import type {
  Company, Paginated, DocumentRow,
  ArApDocumentType, ArApSummary, AgingReport, OpenItem, PaymentRow, RecordPaymentBody,
  AuditEvent, AuditPage, AuditSummary, AuditVerification, AuditFilterParams,
  AccountingPeriod, ViesStatus, ViesValidationResult, ViesDataset,
  MonthlySeries, CashFlowReport,
  BankAccount, BankStatement, BankTransaction, BankingSummary, ImportReport, MatchSuggestion, BankMatchDocumentType,
  SaftExportRecord, SaftValidationSummary, SaftDataset,
} from './types';

/** Multipart upload of a bank statement (CSV/XLSX) with auth + company headers. */
async function uploadStatement(file: File, bankAccountId: string, format?: string): Promise<ImportReport> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bankAccountId', bankAccountId);
  if (format) fd.append('format', format);
  const headers: Record<string, string> = {};
  const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}`;
  const c = getActiveCompany(); if (c) headers['X-Company-Id'] = c;
  const res = await fetch(`${API_BASE}/banking/import`, { method: 'POST', headers, body: fd });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.message ?? `Грешка ${res.status}`, data);
  return data as ImportReport;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const Endpoints = {
  // --- companies ---
  companies: () => api<Company[]>('/companies', { company: false }),
  createCompany: (body: { name: string; eik?: string; vatStatus?: string; baseCurrency?: string }) =>
    api<Company>('/companies', { method: 'POST', body, company: false }),

  // --- documents ---
  documents: (p: { status?: string; type?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<DocumentRow>>(`/documents${qs(p)}`),
  document: (id: string) => api<DocumentRow>(`/documents/${id}`),
  downloadUrl: (id: string) => api<{ url: string }>(`/documents/${id}/download-url`),
  trashDocument: (id: string) => api(`/documents/${id}/trash`, { method: 'POST', body: {} }),
  restoreDocument: (id: string) => api(`/documents/${id}/restore`, { method: 'POST', body: {} }),
  purgeDocument: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }),

  // --- extraction / OCR ---
  extraction: (id: string) => api<any>(`/documents/${id}/extraction`),
  runExtraction: (id: string) => api<any>(`/documents/${id}/extract`, { method: 'POST', body: {} }),
  reviewPackage: (id: string) => api<any>(`/documents/${id}/review-package`),

  // --- suggestions ---
  generateSuggestion: (id: string) => api<any>(`/documents/${id}/suggest`, { method: 'POST', body: {} }),
  suggestion: (id: string) => api<any>(`/documents/${id}/suggestion`),
  setSuggestionCategory: (suggestionId: string, expenseCategoryId: string) =>
    api<any>(`/accounting-suggestions/${suggestionId}/category`, { method: 'PATCH', body: { expenseCategoryId } }),

  // --- expense categories ---
  expenseCategories: (activeOnly = true) => api<any[]>(`/expense-categories${activeOnly ? '' : '?activeOnly=false'}`),

  // --- review ---
  reviewQueue: (p: { status?: string; page?: number; pageSize?: number } = {}) => api<any>(`/reviews/queue${qs(p)}`),
  reviewDashboard: () => api<any>('/reviews/dashboard'),
  reviewDetail: (documentId: string) => api<any>(`/reviews/documents/${documentId}`),
  createReview: (documentId: string) => api<any>(`/reviews/documents/${documentId}`, { method: 'POST', body: {} }),
  approveReview: (packageId: string, comment?: string) => api<any>(`/reviews/${packageId}/approve`, { method: 'POST', body: { comment } }),
  rejectReview: (packageId: string, reason: string) => api<any>(`/reviews/${packageId}/reject`, { method: 'POST', body: { reason } }),
  editReview: (packageId: string, input: Record<string, unknown>) => api<any>(`/reviews/${packageId}/edit`, { method: 'POST', body: input }),
  editFields: (packageId: string, fields: Record<string, string>) => api<any>(`/reviews/${packageId}/fields`, { method: 'POST', body: { fields } }),
  commentReview: (packageId: string, body: string) => api<any>(`/reviews/${packageId}/comment`, { method: 'POST', body: { body } }),

  // --- posting ---
  postReview: (packageId: string) => api<any>(`/reviews/${packageId}/post`, { method: 'POST', body: {} }),
  postingForReview: (packageId: string) => api<any>(`/reviews/${packageId}/posting`),
  postings: (page = 1, pageSize = 50) => api<any[]>(`/postings${qs({ page, pageSize })}`),
  ledgerEntry: (id: string) => api<any>(`/ledger/entries/${id}`),
  ledgerEntries: () => api<any[]>('/ledger/entries'),

  // --- VAT (tax) ---
  vatBuild: (y: number, m: number) => api<any>(`/vat/${y}/${m}/build`, { method: 'POST', body: {} }),
  vatSummary: (y: number, m: number) => api<{ outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number }>(`/vat/${y}/${m}/summary`),
  vatPurchase: (y: number, m: number) => api<any[]>(`/vat/${y}/${m}/purchase-register`),
  vatSales: (y: number, m: number) => api<any[]>(`/vat/${y}/${m}/sales-register`),
  vatReturn: (y: number, m: number) => api<any>(`/vat/${y}/${m}/return`, { method: 'POST', body: {} }),

  // --- invoices ---
  invoices: (status?: string) => api<any[]>(`/invoices${qs({ status })}`),
  invoice: (id: string) => api<any>(`/invoices/${id}`),
  createInvoice: (body: any) => api<any>('/invoices', { method: 'POST', body }),
  issueInvoice: (id: string) => api<any>(`/invoices/${id}/issue`, { method: 'POST', body: {} }),
  emailInvoice: (id: string, toEmail: string) => api<any>(`/invoices/${id}/email`, { method: 'POST', body: { toEmail } }),
  createCreditNote: (id: string) => api<any>(`/invoices/${id}/create-credit-note`, { method: 'POST', body: {} }),
  createDebitNote: (id: string) => api<any>(`/invoices/${id}/create-debit-note`, { method: 'POST', body: {} }),
  convertToInvoice: (id: string) => api<any>(`/invoices/${id}/convert-to-invoice`, { method: 'POST', body: {} }),
  relatedDocuments: (id: string) => api<any>(`/invoices/${id}/related-documents`),

  // --- reports ---
  trialBalance: (from: string, to: string) => api<any>(`/reports/trial-balance${qs({ from, to })}`),
  profitAndLoss: (from: string, to: string) => api<any>(`/reports/profit-and-loss${qs({ from, to })}`),
  generalLedger: (from: string, to: string) => api<any>(`/reports/general-ledger${qs({ from, to })}`),
  journalReport: (from: string, to: string) => api<any[]>(`/reports/journal${qs({ from, to })}`),
  balanceSheet: (asOf: string) => api<any>(`/reports/balance-sheet${qs({ asOf })}`),
  // --- management reports (Revenue/Expenses by Month, Cash Flow) ---
  revenueByMonth: (year: number) => api<MonthlySeries>(`/reports/revenue-by-month${qs({ year })}`),
  expensesByMonth: (year: number) => api<MonthlySeries>(`/reports/expenses-by-month${qs({ year })}`),
  cashFlowReport: (year: number) => api<CashFlowReport>(`/reports/cash-flow${qs({ year })}`),
  revenueByMonthCsv: (year: number) => api<string>(`/reports/revenue-by-month${qs({ year, format: 'csv' })}`),
  expensesByMonthCsv: (year: number) => api<string>(`/reports/expenses-by-month${qs({ year, format: 'csv' })}`),
  cashFlowCsv: (year: number) => api<string>(`/reports/cash-flow${qs({ year, format: 'csv' })}`),

  // --- master data ---
  // /counterparties is paginated ({items,total,...}); normalize to an array for callers.
  counterparties: () => api<any>('/counterparties').then((r) => (Array.isArray(r) ? r : (r?.items ?? []))),
  createCounterparty: (body: { kind: string; name: string; eik?: string; vatNumber?: string }) => api<any>('/counterparties', { method: 'POST', body }),
  accounts: () => api<any[]>('/accounts'),
  vatCodes: () => api<any[]>('/vat-codes'),
  companySettings: () => api<any>('/company-settings'),

  // --- product / service catalog ---
  catalogItems: (p: { activeOnly?: boolean; search?: string; kind?: string } = {}) =>
    api<any>(`/catalog-items${qs({ activeOnly: p.activeOnly ? 'true' : undefined, search: p.search, kind: p.kind })}`).then((r) => (Array.isArray(r) ? r : (r?.items ?? []))),
  catalogItem: (id: string) => api<any>(`/catalog-items/${id}`),
  createCatalogItem: (body: Record<string, unknown>) => api<any>('/catalog-items', { method: 'POST', body }),
  updateCatalogItem: (id: string, body: Record<string, unknown>) => api<any>(`/catalog-items/${id}`, { method: 'PUT', body }),

  // --- account mappings (configurable posting accounts) ---
  accountMappings: (companyId: string) =>
    api<any[]>(`/companies/${companyId}/account-mappings`),
  updateAccountMappings: (companyId: string, mappings: Array<{ role: string; accountId: string }>) =>
    api<any[]>(`/companies/${companyId}/account-mappings`, { method: 'PUT', body: { mappings } }),

  // --- receivables (AR) / payables (AP) — Task 3.1 ---
  receivables: (asOf?: string) => api<OpenItem[]>(`/receivables${qs({ asOf })}`),
  receivablesSummary: (asOf?: string) => api<ArApSummary>(`/receivables/summary${qs({ asOf })}`),
  receivablesAging: (asOf?: string) => api<AgingReport>(`/receivables/aging${qs({ asOf })}`),
  payables: (asOf?: string) => api<OpenItem[]>(`/payables${qs({ asOf })}`),
  payablesSummary: (asOf?: string) => api<ArApSummary>(`/payables/summary${qs({ asOf })}`),
  payablesAging: (asOf?: string) => api<AgingReport>(`/payables/aging${qs({ asOf })}`),
  arAging: (asOf?: string) => api<AgingReport>(`/reports/ar-aging${qs({ asOf })}`),
  apAging: (asOf?: string) => api<AgingReport>(`/reports/ap-aging${qs({ asOf })}`),

  // --- payments ---
  payments: (p: { documentType?: ArApDocumentType; documentId?: string; counterpartyId?: string; page?: number; pageSize?: number } = {}) =>
    api<PaymentRow[]>(`/payments${qs(p)}`),
  payment: (id: string) => api<PaymentRow>(`/payments/${id}`),
  recordPayment: (body: RecordPaymentBody) => api<PaymentRow>('/payments', { method: 'POST', body }),
  reversePayment: (id: string, reason?: string) => api<PaymentRow>(`/payments/${id}/reverse`, { method: 'POST', body: { reason } }),

  // --- audit trail (Task 4.1) ---
  audit: (p: AuditFilterParams = {}) => api<AuditPage>(`/audit${qs(p as Record<string, string | number | undefined>)}`),
  auditTimeline: (limit = 8) => api<AuditEvent[]>(`/audit/timeline${qs({ limit })}`),
  auditSummary: (from?: string, to?: string) => api<AuditSummary>(`/audit/summary${qs({ from, to })}`),
  auditVerify: () => api<AuditVerification>('/audit/verify'),
  auditEntity: (type: string, id: string) => api<AuditEvent[]>(`/audit/entity/${type}/${id}`),

  // --- accounting periods (Task 4.3) ---
  periods: (months = 12) => api<AccountingPeriod[]>(`/periods${qs({ months })}`),
  currentPeriod: () => api<AccountingPeriod>('/periods/current'),
  lockPeriod: (year: number, month: number) => api<AccountingPeriod>('/periods/lock', { method: 'POST', body: { year, month } }),
  openPeriod: (year: number, month: number) => api<AccountingPeriod>('/periods/open', { method: 'POST', body: { year, month } }),

  // --- VIES (Task 4.2) ---
  viesValidate: (vatNumber: string, counterpartyId?: string) => api<ViesValidationResult>('/vies/validate', { method: 'POST', body: { vatNumber, counterpartyId } }),
  viesStatus: (counterpartyId: string) => api<ViesStatus>(`/vies/status/${counterpartyId}`),
  viesRefresh: (counterpartyId: string) => api<ViesValidationResult>(`/vies/refresh/${counterpartyId}`, { method: 'POST', body: {} }),
  viesDataset: (year: number, month: number) => api<ViesDataset>(`/vies/dataset/${year}/${month}`),
  viesDatasetCsv: (year: number, month: number) => api<string>(`/vies/dataset/${year}/${month}?format=csv`),

  // --- banking & reconciliation (Task 3.2) ---
  bankAccounts: () => api<BankAccount[]>('/bank-accounts'),
  createBankAccount: (body: { iban: string; bic?: string; bankName?: string; currency?: string; isPrimary?: boolean }) => api<BankAccount>('/bank-accounts', { method: 'POST', body }),
  updateBankAccount: (id: string, body: { bic?: string; bankName?: string; currency?: string; isActive?: boolean }) => api<BankAccount>(`/bank-accounts/${id}`, { method: 'PATCH', body }),
  setPrimaryBankAccount: (id: string) => api<BankAccount>(`/bank-accounts/${id}/set-primary`, { method: 'POST', body: {} }),
  importStatement: uploadStatement,
  bankStatements: (p: { page?: number; pageSize?: number } = {}) => api<BankStatement[]>(`/banking/statements${qs(p)}`),
  bankTransactions: (p: { status?: string; bankAccountId?: string; statementId?: string; page?: number; pageSize?: number } = {}) => api<BankTransaction[]>(`/banking/transactions${qs(p)}`),
  bankSuggestions: (id: string) => api<MatchSuggestion[]>(`/banking/transactions/${id}/suggestions`),
  bankConfirmMatch: (id: string, body: { documentType: BankMatchDocumentType; documentId: string; amount?: string | number; confidence?: number; reason?: string }) => api<{ transaction: BankTransaction; payment: PaymentRow }>(`/banking/transactions/${id}/confirm-match`, { method: 'POST', body }),
  bankRejectMatch: (id: string, reason?: string) => api<BankTransaction>(`/banking/transactions/${id}/reject-match`, { method: 'POST', body: { reason } }),
  bankManualMatch: (id: string, body: { documentType: BankMatchDocumentType; documentId: string; amount?: string | number }) => api<{ transaction: BankTransaction; payment: PaymentRow }>(`/banking/transactions/${id}/manual-match`, { method: 'POST', body }),
  bankingSummary: () => api<BankingSummary>('/banking/summary'),

  // --- SAF-T v1 ---
  saftExports: (p: { page?: number; pageSize?: number } = {}) => api<SaftExportRecord[]>(`/saft/exports${qs(p)}`),
  generateSaftExport: (year: number, month: number) => api<SaftExportRecord>('/saft/exports', { method: 'POST', body: { year, month } }),
  saftExport: (id: string) => api<SaftExportRecord>(`/saft/exports/${id}`),
  saftDataset: (id: string) => api<SaftDataset>(`/saft/exports/${id}/dataset`),
  saftValidate: (year: number, month: number) => api<SaftValidationSummary>(`/saft/validate/${year}/${month}`),
};
