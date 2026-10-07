export class UnbalancedEntryError extends Error {
  constructor(msg = 'Journal entry is not balanced (double-entry required).') {
    super(msg); this.name = 'UnbalancedEntryError';
  }
}
export class EntryNotFoundError extends Error {
  constructor(id: string) { super(`Journal entry ${id} not found.`); this.name = 'EntryNotFoundError'; }
}
export class AlreadyReversedError extends Error {
  constructor(id: string) { super(`Journal entry ${id} is already reversed.`); this.name = 'AlreadyReversedError'; }
}
/** A payment settlement entry must be reversed through the payment reversal workflow, never
 *  directly through the ledger, otherwise the ledger is reversed while the payment stays active. */
export class SettlementReversalNotAllowedError extends Error {
  constructor(id: string) {
    super(`Journal entry ${id} settles a payment; reverse the payment instead (payment reversal keeps the ledger and the payment consistent).`);
    this.name = 'SettlementReversalNotAllowedError';
  }
}
export class NoActiveCompanyError extends Error {
  constructor() { super('No active company in context; switch company before posting.'); this.name = 'NoActiveCompanyError'; }
}
