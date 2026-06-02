export class InvalidEikError extends Error {
  constructor(eik: string) { super(`Invalid EIK/BULSTAT: ${eik}`); this.name = 'InvalidEikError'; }
}
export class InvalidVatNumberError extends Error {
  constructor(v: string) { super(`Invalid VAT number format: ${v}`); this.name = 'InvalidVatNumberError'; }
}
export class UnknownCountryError extends Error {
  constructor(c: string) { super(`Unknown country code: ${c}`); this.name = 'UnknownCountryError'; }
}
export class DuplicateCounterpartyError extends Error {
  constructor(field: string, value: string) {
    super(`A counterparty with ${field} ${value} already exists in this company.`);
    this.name = 'DuplicateCounterpartyError';
  }
}
export class MasterDataNotFoundError extends Error {
  constructor(what: string, id: string) { super(`${what} ${id} not found.`); this.name = 'MasterDataNotFoundError'; }
}
