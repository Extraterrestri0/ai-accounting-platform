import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DatabaseContextService, TenantContextService, IdempotencyRepository, canonicalFingerprint,
  type ScopedClient,
} from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../../periods';
import { JournalRepository } from '../infrastructure/journal.repository';
import { AlreadyReversedError, EntryNotFoundError, NoActiveCompanyError, SettlementReversalNotAllowedError } from '../domain/errors';
import { LedgerEvents } from '../events';
import type { JournalEntry, NewLine } from '../domain/models';
import type { ILedgerService, PostEntryInput } from './ledger.service.interface';

const todayISO = (): string => new Date().toISOString().slice(0, 10);
/** Coerce a posting date to YYYY-MM-DD. getEntry uses SELECT *, so a DATE column arrives from
 *  node-pg as a JS Date built at LOCAL midnight of the stored calendar date. Read the LOCAL
 *  components — never toISOString(), which shifts the day (and month/year at boundaries) in any
 *  timezone east of UTC, e.g. Europe/Sofia: 2026-06-01 would become 2026-05-31. */
export const toISODate = (d: unknown): string => {
  if (d instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return String(d).slice(0, 10);
};

/** Optional idempotency context for retry-safe financial writes (Pass 1A). */
export interface IdempotencyContext { key: string; }

@Injectable()
export class LedgerService implements ILedgerService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly journals: JournalRepository,
    private readonly idem: IdempotencyRepository,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService,
  ) {}

  /**
   * Post a balanced entry on a CALLER-OWNED transaction (the single authoritative ledger
   * write path — no second writer). Allocates the entry no, inserts entry + lines, appends
   * the atomic ledger audit, and gates the accounting period IN the same transaction. The DB
   * deferred constraint verifies double-entry balance at the caller's COMMIT.
   */
  async postInTx(db: ScopedClient, input: PostEntryInput): Promise<JournalEntry> {
    const { tenantId, companyId, userId } = this.requireCompany();
    await this.periods.assertOpenTx(db, input.postingDate, 'Posting');
    const currency = input.currency ?? 'EUR';
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
  }

  /**
   * Public manual-post entrypoint. Owns one transaction. When an idempotency key is supplied
   * (manual API), a replayed request returns the original entry and a same-key/different-payload
   * request is refused — the claim, the post and its audit all commit together or not at all.
   */
  async postEntry(input: PostEntryInput, idem?: IdempotencyContext): Promise<JournalEntry> {
    const { tenantId, companyId } = this.requireCompany();
    if (!idem) return this.db.run((db) => this.postInTx(db, input));
    const fingerprint = canonicalFingerprint('ledger.post', {
      postingDate: input.postingDate, currency: input.currency ?? 'EUR', sourceType: input.sourceType ?? 'manual',
      sourceRef: input.sourceRef ?? null, description: input.description ?? '',
      lines: input.lines.map((l) => ({ accountId: l.accountId, direction: l.direction, amount: String(l.amount), narrative: l.narrative ?? null })),
    });
    return this.db.run(async (db) => {
      const claim = await this.idem.claim(db, { tenantId, companyId, operation: 'ledger.post', key: idem.key, fingerprint });
      if (claim.status === 'conflict') throw new ConflictException('Idempotency-Key was already used for a different ledger entry.');
      if (claim.status === 'replay') {
        const existing = await this.journals.getEntry(db, String(claim.result.journalEntryId));
        if (existing) return existing;
        throw new ConflictException('Idempotency replay could not resolve the original entry.');
      }
      const entry = await this.postInTx(db, input);
      await this.idem.complete(db, claim.id, { journalEntryId: entry.id });
      return entry;
    });
  }

  /**
   * Public reversal entrypoint (manual ledger API + review reversal). ONE transaction: optional
   * idempotency claim → in-transaction reversal (lock original, period gates, insert) → complete.
   * No period check outside this transaction is relied upon. Settlement (payment) entries are
   * refused here; they must go through the payment reversal workflow.
   */
  async reverseEntry(entryId: string, reason: string, idem?: IdempotencyContext): Promise<JournalEntry> {
    const { tenantId, companyId } = this.requireCompany();
    return this.db.run(async (db) => {
      if (!idem) return this.reverseInTx(db, entryId, reason);
      const fingerprint = canonicalFingerprint('ledger.reverse', { entryId, reason: reason ?? '' });
      const claim = await this.idem.claim(db, { tenantId, companyId, operation: 'ledger.reverse', key: idem.key, fingerprint });
      if (claim.status === 'conflict') throw new ConflictException('Idempotency-Key was already used for a different reversal.');
      if (claim.status === 'replay') {
        const existing = await this.journals.getEntry(db, String(claim.result.journalEntryId));
        if (existing) return existing;
        throw new ConflictException('Idempotency replay could not resolve the reversal entry.');
      }
      const r = await this.reverseInTx(db, entryId, reason);
      await this.idem.complete(db, claim.id, { journalEntryId: r.id });
      return r;
    });
  }

  /**
   * Reverse an entry on a CALLER-OWNED transaction (the single reversal writer; payments reuse it).
   * 1) lock the original FOR UPDATE (concurrent reversals of it serialize; the loser then sees it
   *    reversed), 2) re-check reversed under the lock, 3) fix the reversal posting date ONCE,
   * 4) gate BOTH the original's period and the reversal's period on this client (shared period
   *    locks held to COMMIT, taken in chronological order), 5) insert the mirrored entry + audit.
   * The DB unique index uq_reversal_target remains the final one-reversal-per-original guarantee.
   */
  async reverseInTx(db: ScopedClient, entryId: string, reason: string, opts: { allowSettlement?: boolean } = {}): Promise<JournalEntry> {
    const { tenantId, companyId, userId } = this.requireCompany();
    if (!(await this.journals.lockEntry(db, entryId))) throw new EntryNotFoundError(entryId);
    const original = await this.journals.getEntry(db, entryId);
    if (!original) throw new EntryNotFoundError(entryId);
    if (original.sourceType === 'payment' && !opts.allowSettlement) throw new SettlementReversalNotAllowedError(entryId);
    if (await this.journals.isReversed(db, entryId)) throw new AlreadyReversedError(entryId);

    const originalDate = toISODate(original.postingDate);
    const reversalDate = todayISO();
    for (const d of [...new Set([originalDate, reversalDate])].sort()) {
      await this.periods.assertOpenTx(db, d, 'Reversal');
    }

    const entryNo = await this.journals.nextEntryNo(db, tenantId, companyId);
    let reversalId: string;
    try {
      reversalId = await this.journals.insertEntry(db, {
        tenantId, companyId, entryNo, postingDate: reversalDate,
        description: `Reversal of entry ${original.entryNo}`, sourceType: 'reversal',
        sourceRef: original.id, currency: original.currency, reversesEntryId: original.id,
        actorType: 'user', actorId: userId,
      });
    } catch (e) {
      // Defensive: the one-reversal unique index fired (should be unreachable behind the row lock).
      const pg = e as { code?: string; constraint?: string };
      if (pg.code === '23505' && pg.constraint === 'uq_reversal_target') throw new AlreadyReversedError(entryId);
      throw e;
    }
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
