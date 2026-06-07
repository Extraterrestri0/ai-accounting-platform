import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { PeriodController } from './api/period.controller';
import { PERIOD_SERVICE } from './application/period.service.interface';
import { AccountingPeriodService } from './application/period.service';
import { PeriodRepository } from './infrastructure/period.repository';

/**
 * Accounting Periods bounded context (Task 4.3). Public surface: PERIOD_SERVICE.
 * It is the compliance gate other accounting writers call (assertOpen) before
 * committing, and it owns the lock/open transitions (audited). Depends only on
 * AuditModule — so it can be safely imported by ledger/invoicing/payments/tax
 * without creating a cycle.
 */
@Module({
  imports: [AuditModule],
  controllers: [PeriodController],
  providers: [{ provide: PERIOD_SERVICE, useClass: AccountingPeriodService }, PeriodRepository],
  exports: [PERIOD_SERVICE],
})
export class PeriodsModule {}
