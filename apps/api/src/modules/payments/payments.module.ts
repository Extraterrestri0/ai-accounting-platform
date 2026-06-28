import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { LedgerModule } from '../ledger';
import { MasterDataModule } from '../masterdata';
import { PeriodsModule } from '../periods';
import { PaymentsController } from './api/payments.controller';
import { ReceivablesController } from './api/receivables.controller';
import { PayablesController } from './api/payables.controller';
import { PAYMENT_SERVICE } from './application/payment.service.interface';
import { PaymentService } from './application/payment.service';
import { RECEIVABLES_SERVICE } from './application/receivables.service.interface';
import { ReceivablesService } from './application/receivables.service';
import { PAYABLES_SERVICE } from './application/payables.service.interface';
import { PayablesService } from './application/payables.service';
import { PaymentsRepository } from './infrastructure/payments.repository';

/**
 * Payments bounded context (Task 3.1 — Receivables & Payables Engine).
 *
 * Public surface: PAYMENT_SERVICE, RECEIVABLES_SERVICE, PAYABLES_SERVICE.
 * recordPayment posts a balanced SETTLEMENT entry to the immutable ledger through
 * LEDGER_SERVICE using the configurable account mapping (cash_bank/receivable/
 * payable — never hardcoded); reversals are ledger reversing entries. The AR/AP
 * read-models read invoices + posted purchase entries directly (sanctioned
 * financial read-model, mirroring `reporting`). Settlement entries are tagged
 * source_type='payment' and excluded from the VAT registers.
 */
@Module({
  imports: [AuditModule, LedgerModule, MasterDataModule, PeriodsModule],
  controllers: [PaymentsController, ReceivablesController, PayablesController],
  providers: [
    { provide: PAYMENT_SERVICE, useClass: PaymentService },
    { provide: RECEIVABLES_SERVICE, useClass: ReceivablesService },
    { provide: PAYABLES_SERVICE, useClass: PayablesService },
    PaymentsRepository,
  ],
  exports: [PAYMENT_SERVICE, RECEIVABLES_SERVICE, PAYABLES_SERVICE],
})
export class PaymentsModule {}
