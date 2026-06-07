import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { REPORTS_SERVICE, type IReportsService } from '../application/reports.service.interface';
import { RECEIVABLES_SERVICE, type IReceivablesService, PAYABLES_SERVICE, type IPayablesService } from '../../payments';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { monthlySeriesCsv, cashFlowCsv } from '../domain/reports/management-csv';

/** Financial report endpoints. Read-only; guarded by LEDGER_READ (reports read the ledger). */
@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(REPORTS_SERVICE) private readonly reports: IReportsService,
    @Inject(RECEIVABLES_SERVICE) private readonly receivables: IReceivablesService,
    @Inject(PAYABLES_SERVICE) private readonly payables: IPayablesService,
  ) {}
  private period(from?: string, to?: string) { return { from: from ?? '0001-01-01', to: to ?? '9999-12-31' }; }

  @Get('trial-balance') @RequirePermission(PERMISSIONS.LEDGER_READ)
  trialBalance(@Query('from') from?: string, @Query('to') to?: string, @Query('snapshot') snap?: string) { return this.reports.trialBalance(this.period(from, to), snap === 'true'); }

  @Get('general-ledger') @RequirePermission(PERMISSIONS.LEDGER_READ)
  generalLedger(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.generalLedger(this.period(from, to)); }

  @Get('account-card') @RequirePermission(PERMISSIONS.LEDGER_READ)
  accountCard(@Query('account') account: string, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.accountCard(account, this.period(from, to)); }

  @Get('journal') @RequirePermission(PERMISSIONS.LEDGER_READ)
  journal(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.journalReport(this.period(from, to)); }

  @Get('profit-and-loss') @RequirePermission(PERMISSIONS.LEDGER_READ)
  pnl(@Query('from') from?: string, @Query('to') to?: string, @Query('snapshot') snap?: string) { return this.reports.profitAndLoss(this.period(from, to), snap === 'true'); }

  @Get('balance-sheet') @RequirePermission(PERMISSIONS.LEDGER_READ)
  balanceSheet(@Query('asOf') asOf?: string, @Query('snapshot') snap?: string) { return this.reports.balanceSheet(asOf ?? new Date().toISOString().slice(0, 10), snap === 'true'); }

  @Get('vat') @RequirePermission(PERMISSIONS.VAT_READ)
  vat(@Query('year') year: string, @Query('month') month: string) { return this.reports.vatReport(Number(year), Number(month)); }

  @Get('invoices') @RequirePermission(PERMISSIONS.INVOICE_READ)
  invoices(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.invoiceReport(this.period(from, to)); }

  // ---- AR/AP aging (Task 3.1) — delegate to the Payments read-models ----------
  @Get('ar-aging') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  arAging(@Query('asOf') asOf?: string) { return this.receivables.getReceivablesAging(asOf || undefined); }

  @Get('ap-aging') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  apAging(@Query('asOf') asOf?: string) { return this.payables.getPayablesAging(asOf || undefined); }

  // ---- Management reports (ledger-derived; year-based, monthly buckets) --------
  private yr(year?: string): number { const y = Number(year); return Number.isInteger(y) && y > 2000 ? y : new Date().getFullYear(); }

  @Get('revenue-by-month') @RequirePermission(PERMISSIONS.LEDGER_READ)
  async revenueByMonth(@Query('year') year: string | undefined, @Query('currency') currency: string | undefined, @Query('format') format: string | undefined, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.revenueByMonth(this.yr(year), currency || 'EUR');
    return format === 'csv' ? this.csv(res, `revenue-${r.year}`, monthlySeriesCsv('Приходи', r)) : r;
  }

  @Get('expenses-by-month') @RequirePermission(PERMISSIONS.LEDGER_READ)
  async expensesByMonth(@Query('year') year: string | undefined, @Query('currency') currency: string | undefined, @Query('format') format: string | undefined, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.expensesByMonth(this.yr(year), currency || 'EUR');
    return format === 'csv' ? this.csv(res, `expenses-${r.year}`, monthlySeriesCsv('Разходи', r)) : r;
  }

  @Get('cash-flow') @RequirePermission(PERMISSIONS.LEDGER_READ)
  async cashFlow(@Query('year') year: string | undefined, @Query('currency') currency: string | undefined, @Query('format') format: string | undefined, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.cashFlow(this.yr(year), currency || 'EUR');
    return format === 'csv' ? this.csv(res, `cash-flow-${r.year}`, cashFlowCsv(r)) : r;
  }

  private csv(res: Response, filename: string, body: string): string {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return `﻿${body}`; // UTF-8 BOM for Excel/Cyrillic
  }
}
