import type { ApplicationService } from '../../../shared-kernel';
import type { RegisterRow, ValidationIssue, VatPeriod, VatReturnDataset, VatSummary } from '../domain/vat/models';

export interface VatReturnResult { period: VatPeriod; summary: VatSummary; dataset: VatReturnDataset; }

/** PUBLIC VAT service — Bulgarian VAT registers + return dataset from posted entries. */
export interface IVatService extends ApplicationService {
  /** Build (idempotent) the purchase + sales registers for a month from posted ledger entries. */
  buildRegisters(year: number, month: number): Promise<{ period: VatPeriod; purchase: RegisterRow[]; sales: RegisterRow[] }>;
  getPurchaseRegister(year: number, month: number): Promise<RegisterRow[]>;
  getSalesRegister(year: number, month: number): Promise<RegisterRow[]>;
  getSummary(year: number, month: number): Promise<VatSummary>;
  generateReturn(year: number, month: number): Promise<VatReturnResult>;
  validatePeriod(year: number, month: number): Promise<ValidationIssue[]>;
}
export const VAT_SERVICE = Symbol('Tax.VatService');
