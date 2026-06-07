import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../periods';
import { JournalRepository } from '../infrastructure/journal.repository';
import { AlreadyReversedError, EntryNotFoundError, NoActiveCompanyError } from '../domain/errors';
import { LedgerEvents } from '../events';
import type { JournalEntry, NewLine } from '../domain/models';
import type { ILedgerService, PostEntryInput } from './ledger.service.interface';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

@Injectable()
export class LedgerService implements ILedgerService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly journals: JournalRepository,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService,
  ) {}

  /**
   * Posting workflow: allocate entry no -> insert entry -> insert lines -> append audit,
   * ALL in one transaction. The DB deferred constraint enforces double-entry balance at
   * COMMIT; an unbalanced entry makes the whole transaction (incl. audit) roll back.
   */
  async postEntry(input: PostEntryInput): Promise<JournalEntry> {
    const { tenantId, companyId, userId } = this.requireCompany();
    // Compliance gate (Task 4.3): refuse posting into a locked accounting period.
    await this.periods.assertOpen(input.postingDate, 'Posting');
    const currency = input.currency ?? 'EUR';
    return this.db.run(async (db) => {
      const entryNo = await this.journals.nextEntryNo(db, tenantId, companyId);
      const entryId = await this.journals.insertEntry(db, {
        tenantId, companyId, entryNo, postingDate: input.postingDate,
        description: input.description ?? '', sourceType: input.sourceType ?? 'manual',
        sourceRef: input.sourceRef, currency, actorType: 'user', actorId: userId,
      });
      await this.journals.insertLines(db, { tenantId, companyId, entryId, currency, lines: input.lines });
      const entry = await this.journals.getEntry(db, entryId);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId,
        action: LedgerEvents.EntryPosted, entityType: 'journal_entry', entityId: entryId,
        after: entry,
      });
      return entry as JournalEntry; // balance verified at COMMIT
    });
  }

  /** Reversal workflow: mirror the original's lines (swap direction) into a new entry. */
  async reverseEntry(entryId: string, reason: string): Promise<JournalEntry> {
    const { tenantId, companyId, userId } = this.requireCompany();
    // Compliance gate (Task 4.3), evaluated BEFORE the write transaction: cannot
    // reverse an entry that lives in a locked period, and cannot post the reversal
    // into a locked (current) period.
    const pre = await this.getEntry(entryId);
    if (!pre) throw new EntryNotFoundError(entryId);
    await this.periods.assertOpen(pre.postingDate, 'Reversal');
    await this.periods.assertOpen(todayISO(), 'Reversal');

    return this.db.run(async (db) => {
      const original = await this.journals.getEntry(db, entryId);
      if (!original) throw new EntryNotFoundError(entryId);
      if (await this.journals.isReversed(db, entryId)) throw new AlreadyReversedError(entryId);

      const entryNo = await this.journals.nextEntryNo(db, tenantId, companyId);
      const reversalId = await this.journals.insertEntry(db, {
        tenantId, companyId, entryNo, postingDate: new Date().toISOString().slice(0, 10),
        description: `Reversal of entry ${original.entryNo}`, sourceType: 'reversal',
        sourceRef: original.id, currency: original.currency, reversesEntryId: original.id,
        actorType: 'user', actorId: userId,
      });
      const mirrored: NewLine[] = original.lines.map((l) => ({
        accountId: l.accountId,
        direction: l.direction === 'debit' ? 'credit' : 'debit',
        amount: l.amount,
        narrative: l.narrative,
      }));
      await this.journals.insertLines(db, { tenantId, companyId, entryId: reversalId, currency: original.currency, lines: mirrored });
      const reversal = await this.journals.getEntry(db, reversalId);
      await this.audit.append(db, {
        companyId, actorType: 'user', actorId: userId,
        action: LedgerEvents.EntryReversed, entityType: 'journal_entry', entityId: reversalId,
        reason, before: original, after: reversal,
      });
      return reversal as JournalEntry;
    });
  }

  getEntry(entryId: string): Promise<JournalEntry | null> {
    this.requireCompany();
    return this.db.run((db) => this.journals.getEntry(db, entryId));
  }

  listEntries(limit = 50, offset = 0): Promise<JournalEntry[]> {
    this.requireCompany();
    return this.db.run((db) => this.journals.listEntries(db, limit, offset));
  }

  private requireCompany(): { tenantId: string; companyId: string; userId: string } {
    const ctx = this.ctx.currentOrThrow();
    if (!ctx.companyId) throw new NoActiveCompanyError();
    return { tenantId: ctx.tenantId, companyId: ctx.companyId, userId: ctx.userId };
  }
}
