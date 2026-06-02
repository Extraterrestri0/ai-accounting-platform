// Domain event contracts PUBLISHED by the Tax context (names are stable;
// payload shapes are finalized in the tax feature task). Subscribers depend on these.

export const TaxEvents = {
  VatPeriodAssembled: 'tax.vat_period_assembled',
  VatReturnValidated: 'tax.vat_return_validated',
  VatReturnExported: 'tax.vat_return_exported',
} as const;

export type TaxEventType = (typeof TaxEvents)[keyof typeof TaxEvents];
