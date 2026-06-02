export type Direction = 'debit' | 'credit';

export interface JournalLine {
  id: string;
  entryId: string;
  lineNo: number;
  accountId: string;
  direction: Direction;
  amount: string;     // exact decimal as string (never float)
  currency: string;
  narrative?: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  companyId: string;
  entryNo: number;
  postingDate: string;
  description: string;
  sourceType: string;
  sourceRef?: string;
  currency: string;
  status: string;
  reversesEntryId?: string;
  createdByActorType: string;
  createdByActorId?: string;
  createdAt: string;
  lines: JournalLine[];
}

export interface NewLine {
  accountId: string;
  direction: Direction;
  amount: string;     // decimal string, e.g. "100.00"
  narrative?: string;
}
