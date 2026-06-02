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
export class NoActiveCompanyError extends Error {
  constructor() { super('No active company in context; switch company before posting.'); this.name = 'NoActiveCompanyError'; }
}
