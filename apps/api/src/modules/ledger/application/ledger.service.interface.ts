import type { ApplicationService } from '../../../shared-kernel';
import type { JournalEntry, NewLine } from '../domain/models';

export interface PostEntryInput {
  postingDate: string;          // ISO date
  description?: string;
  sourceType?: string;          // 'manual' | 'invoice' | ...
  sourceRef?: string;
  currency?: string;            // defaults EUR
  lines: NewLine[];             // >= 2; must balance
}

/**
 * PUBLIC ledger service. The ONLY way to write the ledger. Posting + its audit
 * event commit atomically. Corrections are reversing entries (no edit/delete).
 */
export interface ILedgerService extends ApplicationService {
  postEntry(input: PostEntryInput, idem?: { key: string }): Promise<JournalEntry>;
  /** Post on a caller-owned transaction — the atomic settlement path (payments/banking). */
  postInTx(db: import('../../../platform').ScopedClient, input: PostEntryInput): Promise<JournalEntry>;
  reverseEntry(entryId: string, reason: string, idem?: { key: string }): Promise<JournalEntry>;
  /** Reverse on a caller-owned transaction (payment reversal path). allowSettlement lets the
   *  payments workflow reverse its own settlement entry; the public API path never sets it. */
  reverseInTx(db: import('../../../platform').ScopedClient, entryId: string, reason: string, opts?: { allowSettlement?: boolean }): Promise<JournalEntry>;
  getEntry(entryId: string): Promise<JournalEntry | null>;
  listEntries(limit?: number, offset?: number): Promise<JournalEntry[]>;
}
export const LEDGER_SERVICE = Symbol('Ledger.Service');
