// Domain event contracts PUBLISHED by the Ledger context (names are stable;
// payload shapes are finalized in the ledger feature task). Subscribers depend on these.

export const LedgerEvents = {
  EntryPosted: 'ledger.entry_posted',
  EntryReversed: 'ledger.entry_reversed',
  PeriodOpened: 'ledger.period_opened',
  PeriodLocked: 'ledger.period_locked',
} as const;

export type LedgerEventType = (typeof LedgerEvents)[keyof typeof LedgerEvents];
