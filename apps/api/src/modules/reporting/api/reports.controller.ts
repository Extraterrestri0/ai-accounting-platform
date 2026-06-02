import { Controller, Get, Inject, Query } from '@nestjs/common';
import { REPORTS_SERVICE, type IReportsService } from '../application/reports.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';

/** Financial report endpoints. Read-only; guarded by LEDGER_READ (reports read the ledger). */
@Controller('reports')
export class ReportsController {
  constructor(@Inject(REPORTS_SERVICE) private readonly reports: IReportsService) {}
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
}
