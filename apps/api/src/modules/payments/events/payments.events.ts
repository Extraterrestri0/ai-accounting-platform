// Domain event / audit-action names PUBLISHED by the Payments context (Task 3.1).
// Stable strings — also used as the audit-trail `action` for each settlement.
export const PaymentEvents = {
  PaymentRecorded: 'payment.recorded',
  PaymentReversed: 'payment.reversed',
  ReceivableClosed: 'receivable.closed',
  PayableClosed: 'payable.closed',
} as const;

export type PaymentEventType = (typeof PaymentEvents)[keyof typeof PaymentEvents];
