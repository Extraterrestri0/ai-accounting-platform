import type { ApplicationService } from '../../../shared-kernel';
import type { AccountCard, BalanceSheet, CashFlowReport, GeneralLedgerAccount, InvoiceReportRow, JournalReportEntry, MonthlySeries, ProfitAndLoss, TrialBalance } from '../domain/reports/models';

export interface Period { from: string; to: string }
export interface VatReportResult { outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number; }

/** PUBLIC reports service — computes from immutable ledger / invoices / VAT, with optional snapshots. */
export interface IReportsService extends ApplicationService {
  trialBalance(period: Period, snapshot?: boolean): Promise<TrialBalance>;
  generalLedger(period: Period): Promise<GeneralLedgerAccount[]>;
  accountCard(accountCode: string, period: Period): Promise<AccountCard>;
  journalReport(period: Period): Promise<JournalReportEntry[]>;
  profitAndLoss(period: Period, snapshot?: boolean): Promise<ProfitAndLoss>;
  balanceSheet(asOf: string, snapshot?: boolean): Promise<BalanceSheet>;
  vatReport(year: number, month: number): Promise<VatReportResult>;
  invoiceReport(period: Period): Promise<InvoiceReportRow[]>;

  // ---- Management reports (Revenue/Expenses by Month, Cash Flow) ----
  revenueByMonth(year: number, currency?: string): Promise<MonthlySeries>;
  expensesByMonth(year: number, currency?: string): Promise<MonthlySeries>;
  cashFlow(year: number, currency?: string): Promise<CashFlowReport>;
}
export const REPORTS_SERVICE = Symbol('Reporting.ReportsService');
