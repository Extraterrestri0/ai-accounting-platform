// Domain event / audit-action names PUBLISHED by the Banking context (Task 3.2).
export const BankEvents = {
  AccountCreated: 'bank.account_created',
  AccountUpdated: 'bank.account_updated',
  StatementImported: 'bank.statement_imported',
  TransactionCreated: 'bank.transaction_created',
  MatchSuggested: 'bank.match_suggested',
  MatchConfirmed: 'bank.match_confirmed',
  MatchRejected: 'bank.match_rejected',
  ManualMatchConfirmed: 'bank.manual_match_confirmed',
} as const;

export type BankEventType = (typeof BankEvents)[keyof typeof BankEvents];
