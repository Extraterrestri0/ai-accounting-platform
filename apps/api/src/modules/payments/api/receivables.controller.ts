import { Controller, Get, Inject, Query, UseFilters } from '@nestjs/common';
import { RECEIVABLES_SERVICE, type IReceivablesService } from '../application/receivables.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { PaymentsErrorFilter } from './payments-error.filter';

/** Accounts Receivable read endpoints (unpaid customer invoices). Read-only. */
@Controller('receivables')
@UseFilters(PaymentsErrorFilter)
export class ReceivablesController {
  constructor(@Inject(RECEIVABLES_SERVICE) private readonly receivables: IReceivablesService) {}

  @Get() @RequirePermission(PERMISSIONS.PAYMENT_READ)
  list(@Query('asOf') asOf?: string) { return this.receivables.getReceivables(asOf || undefined); }

  @Get('summary') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  summary(@Query('asOf') asOf?: string) { return this.receivables.getReceivablesSummary(asOf || undefined); }

  @Get('aging') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  aging(@Query('asOf') asOf?: string) { return this.receivables.getReceivablesAging(asOf || undefined); }
}
