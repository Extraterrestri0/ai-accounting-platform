import type { ApplicationService } from '../../../shared-kernel';
import type { ViesDataset, ViesStatus, ViesValidationResult } from '../domain/models';

export interface ValidateVatInput {
  vatNumber: string;
  counterpartyId?: string;
  force?: boolean;          // bypass the cache (force a live check)
}

/**
 * PUBLIC VIES service (Task 4.2). Validates EU VAT numbers with a cache-first flow:
 *   1) fresh cached result → 2) live VIES validation → 3) store → 4) normalized result.
 * Also builds the monthly VIES (recapitulative) declaration dataset from issued
 * intra-community invoices. All reads/writes are company-scoped (RLS isolates tenants).
 */
export interface IViesService extends ApplicationService {
  validateVatNumber(input: ValidateVatInput): Promise<ViesValidationResult>;
  getCachedResult(vatNumber: string): Promise<ViesValidationResult | null>;
  refreshValidation(counterpartyId: string): Promise<ViesValidationResult>;
  getStatus(counterpartyId: string): Promise<ViesStatus>;
  buildViesDataset(year: number, month: number): Promise<ViesDataset>;
}
export const VIES_SERVICE = Symbol('Vies.ViesService');
