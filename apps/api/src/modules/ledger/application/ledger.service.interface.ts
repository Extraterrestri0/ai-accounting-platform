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
  postEntry(input: PostEntryInput): Promise<JournalEntry>;
  reverseEntry(entryId: string, reason: string): Promise<JournalEntry>;
  getEntry(entryId: string): Promise<JournalEntry | null>;
  listEntries(limit?: number, offset?: number): Promise<JournalEntry[]>;
}
export const LEDGER_SERVICE = Symbol('Ledger.Service');
