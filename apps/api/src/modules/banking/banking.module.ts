import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { PaymentsModule } from '../payments';
import { BankAccountsController } from './api/bank-accounts.controller';
import { BankingController } from './api/banking.controller';
import { BANK_ACCOUNT_SERVICE } from './application/bank-account.service.interface';
import { BankAccountService } from './application/bank-account.service';
import { BANK_IMPORT_SERVICE } from './application/bank-import.service.interface';
import { BankImportService } from './application/bank-import.service';
import { RECONCILIATION_SERVICE } from './application/reconciliation.service.interface';
import { ReconciliationService } from './application/reconciliation.service';
import { STATEMENT_PARSER_REGISTRY } from './application/statement-parser.port';
import { BankingRepository } from './infrastructure/banking.repository';
import { CsvStatementParser } from './infrastructure/parsers/csv-parser';
import { XlsxStatementParser } from './infrastructure/parsers/xlsx-parser';
import { StatementParserRegistry } from './infrastructure/parsers/parser-registry';

/**
 * Banking & Reconciliation bounded context (Task 3.2). Imports statements (CSV/XLSX),
 * lists unreconciled transactions, suggests AR/AP matches, and — on user confirmation —
 * RECORDS A PAYMENT through the existing PaymentService (no new payment/ledger logic),
 * which closes the receivable/payable. Parsers are pluggable (MT940/CAMT later).
 */
@Module({
  imports: [AuditModule, PaymentsModule],
  controllers: [BankAccountsController, BankingController],
  providers: [
    { provide: BANK_ACCOUNT_SERVICE, useClass: BankAccountService },
    { provide: BANK_IMPORT_SERVICE, useClass: BankImportService },
    { provide: RECONCILIATION_SERVICE, useClass: ReconciliationService },
    { provide: STATEMENT_PARSER_REGISTRY, useClass: StatementParserRegistry },
    CsvStatementParser,
    XlsxStatementParser,
    BankingRepository,
  ],
  exports: [BANK_ACCOUNT_SERVICE, BANK_IMPORT_SERVICE, RECONCILIATION_SERVICE],
})
export class BankingModule {}
