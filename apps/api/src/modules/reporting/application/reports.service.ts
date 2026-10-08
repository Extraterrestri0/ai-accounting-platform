import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { VAT_SERVICE, type IVatService } from '../../tax';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../../masterdata';
import { ReportsRepository } from '../infrastructure/reports.repository';
import { accountCard, balanceSheet, cashFlow, expensesByMonth, generalLedger, journalReport, profitAndLoss, revenueByMonth, trialBalance } from '../domain/reports/calculator';
import { ReportingEvents } from '../events';
import type { AccountCard, BalanceSheet, CashFlowReport, GeneralLedgerAccount, InvoiceReportRow, JournalReportEntry, MonthlySeries, ProfitAndLoss, ReportType, TrialBalance } from '../domain/reports/models';
import type { IReportsService, Period, VatReportResult } from './reports.service.interface';

class ReportError extends Error {}
const yearBounds = (year: number): Period => ({ from: `${year}-01-01`, to: `${year}-12-31` });

@Injectable()
export class ReportsService implements IReportsService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: ReportsRepository,
    @Inject(VAT_SERVICE) private readonly vat: IVatService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new ReportError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  private async record(reportType: ReportType, params: unknown, periodStart: string | null, periodEnd: string | null, payload: unknown, snapshot: boolean, action: string = ReportingEvents.ReportGenerated): Promise<void> {
    const { tenantId, companyId, userId } = this.scope();
    await this.db.run(async (db) => {
      const runId = await this.repo.createRun(db, tenantId, companyId, reportType, params, userId);
      if (snapshot) {
        const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        await this.repo.saveSnapshot(db, tenantId, companyId, runId, reportType, periodStart, periodEnd, payload, checksum);
      }
      await this.audit.append(db, { companyId, actorType: userId ? 'user' : 'system', actorId: userId, action, entityType: 'report_run', entityId: runId, after: { reportType, params } });
    });
  }

  async trialBalance(period: Period, snapshot = false): Promise<TrialBalance> {
    this.scope();
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, period.from, period.to));
    const result = trialBalance(lines, period);
    await this.record('trial_balance', period, period.from, period.to, result, snapshot);
    return result;
  }
  async generalLedger(period: Period): Promise<GeneralLedgerAccount[]> {
    this.scope();
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, period.from, period.to));
    const result = generalLedger(lines);
    await this.record('general_ledger', period, period.from, period.to, result, false);
    return result;
  }
  async accountCard(accountCode: string, period: Period): Promise<AccountCard> {
    this.scope();
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, period.from, period.to));
    const result = accountCard(lines, accountCode, period);
    await this.record('account_card', { accountCode, ...period }, period.from, period.to, result, false);
    return result;
  }
  async journalReport(period: Period): Promise<JournalReportEntry[]> {
    this.scope();
    const entries = await this.db.run((db) => this.repo.journalEntries(db, period.from, period.to));
    const result = journalReport(entries);
    await this.record('journal', period, period.from, period.to, result, false);
    return result;
  }
  async profitAndLoss(period: Period, snapshot = false): Promise<ProfitAndLoss> {
    this.scope();
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, period.from, period.to));
    const result = profitAndLoss(lines, period);
    await this.record('profit_and_loss', period, period.from, period.to, result, snapshot);
    return result;
  }
  async balanceSheet(asOf: string, snapshot = false): Promise<BalanceSheet> {
    this.scope();
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, '0001-01-01', asOf));
    const result = balanceSheet(lines, asOf);
    await this.record('balance_sheet', { asOf }, null, asOf, result, snapshot);
    return result;
  }
  async vatReport(year: number, month: number): Promise<VatReportResult> {
    this.scope();
    const summary = await this.vat.getSummary(year, month);
    await this.record('vat', { year, month }, null, null, summary, false);
    return summary;
  }
  async invoiceReport(period: Period): Promise<InvoiceReportRow[]> {
    this.scope();
    const rows = await this.db.run((db) => this.repo.invoices(db, period.from, period.to));
    await this.record('invoice', period, period.from, period.to, rows, false);
    return rows;
  }

  // ---- Management reports (ledger-derived) ----
  async revenueByMonth(year: number, currency = 'EUR'): Promise<MonthlySeries> {
    this.scope();
    const p = yearBounds(year);
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, p.from, p.to));
    const result = revenueByMonth(lines, year, currency);
    await this.record('revenue_by_month', { year, currency }, p.from, p.to, result, false, ReportingEvents.RevenueByMonthGenerated);
    return result;
  }

  async expensesByMonth(year: number, currency = 'EUR'): Promise<MonthlySeries> {
    this.scope();
    const p = yearBounds(year);
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, p.from, p.to));
    const result = expensesByMonth(lines, year, currency);
    await this.record('expenses_by_month', { year, currency }, p.from, p.to, result, false, ReportingEvents.ExpensesByMonthGenerated);
    return result;
  }

  async cashFlow(year: number, currency = 'EUR'): Promise<CashFlowReport> {
    this.scope();
    const p = yearBounds(year);
    // Cash/bank account resolved via the configurable mapping (never hardcoded).
    const accounts = await this.masterdata.getPostingAccounts();
    const lines = await this.db.run((db) => this.repo.ledgerLines(db, p.from, p.to));
    const result = cashFlow(lines, accounts.cash_bank, year, currency);
    await this.record('cash_flow', { year, currency }, p.from, p.to, result, false, ReportingEvents.CashFlowGenerated);
    return result;
  }
}
