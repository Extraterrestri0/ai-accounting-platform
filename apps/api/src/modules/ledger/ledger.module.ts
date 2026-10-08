import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { PeriodsModule } from '../periods';
import { LedgerController } from './api/ledger.controller';
import { LEDGER_SERVICE } from './application/ledger.service.interface';
import { LedgerService } from './application/ledger.service';
import { JournalRepository } from './infrastructure/journal.repository';

/**
 * Ledger bounded context. Imports AuditModule to append audit events in the SAME
 * transaction as a posting/reversal (via IAuditService.append(scopedClient, ...)).
 * Exposes ONLY LEDGER_SERVICE + events. Repositories are private.
 */
@Module({
  imports: [AuditModule, PeriodsModule],
  controllers: [LedgerController],
  providers: [{ provide: LEDGER_SERVICE, useClass: LedgerService }, JournalRepository],
  exports: [LEDGER_SERVICE],
})
export class LedgerModule {}
