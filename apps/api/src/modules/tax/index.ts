export { TaxModule } from './tax.module';
export * from './application'; // ITaxService + IVatService + tokens
export * from './events';
export type { RegisterRow, VatSummary, VatReturnDataset, VatPeriod, RegisterKind, VatTreatment, ValidationIssue } from './domain/vat/models';
