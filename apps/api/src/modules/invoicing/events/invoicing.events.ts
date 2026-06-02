// Domain event contracts PUBLISHED by the Invoicing context (names are stable;
// payload shapes are finalized in the invoicing feature task). Subscribers depend on these.

export const InvoicingEvents = {
  InvoiceIssued: 'invoicing.invoice_issued',
  InvoiceSent: 'invoicing.invoice_sent',
  PaymentRecorded: 'invoicing.payment_recorded',
} as const;

export type InvoicingEventType = (typeof InvoicingEvents)[keyof typeof InvoicingEvents];
