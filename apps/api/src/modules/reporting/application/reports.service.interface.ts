import type { ApplicationService } from '../../../shared-kernel';
import type { AccountCard, BalanceSheet, GeneralLedgerAccount, InvoiceReportRow, JournalReportEntry, ProfitAndLoss, TrialBalance } from '../domain/reports/models';

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
}
export const REPORTS_SERVICE = Symbol('Reporting.ReportsService');
