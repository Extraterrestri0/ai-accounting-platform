/** Payments domain errors. Mapped to user-safe 4xx envelopes at the API edge. */
export { OverpaymentError } from './aging';

export class PaymentError extends Error {}
export class DocumentNotFoundError extends PaymentError {
  constructor(documentId: string) { super(`Document ${documentId} was not found or is not settleable.`); }
}
export class PaymentNotFoundError extends PaymentError {
  constructor(id: string) { super(`Payment ${id} was not found.`); }
}
export class AlreadyReversedError extends PaymentError {
  constructor(id: string) { super(`Payment ${id} has already been reversed.`); }
}
export class AccountNotConfiguredError extends PaymentError {
  constructor(role: string, code: string) {
    super(`The ${role} account (${code}) is not configured for this company; cannot post the settlement.`);
  }
}
