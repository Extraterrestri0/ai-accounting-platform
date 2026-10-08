import { Controller, Get, Inject, Query, UseFilters } from '@nestjs/common';
import { PAYABLES_SERVICE, type IPayablesService } from '../application/payables.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { PaymentsErrorFilter } from './payments-error.filter';

/** Accounts Payable read endpoints (unpaid supplier/purchase documents). Read-only. */
@Controller('payables')
@UseFilters(PaymentsErrorFilter)
export class PayablesController {
  constructor(@Inject(PAYABLES_SERVICE) private readonly payables: IPayablesService) {}

  @Get() @RequirePermission(PERMISSIONS.PAYMENT_READ)
  list(@Query('asOf') asOf?: string) { return this.payables.getPayables(asOf || undefined); }

  @Get('summary') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  summary(@Query('asOf') asOf?: string) { return this.payables.getPayablesSummary(asOf || undefined); }

  @Get('aging') @RequirePermission(PERMISSIONS.PAYMENT_READ)
  aging(@Query('asOf') asOf?: string) { return this.payables.getPayablesAging(asOf || undefined); }
}
