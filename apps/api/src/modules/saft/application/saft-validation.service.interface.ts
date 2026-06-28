import type { ApplicationService } from '../../../shared-kernel';
import type { SaftDataset, ValidationSummary } from '../domain/models';

export interface ISaftValidationService extends ApplicationService {
  validateDataset(dataset: SaftDataset): ValidationSummary;
  /** Build (for a period) + validate; audits the validation. */
  validatePeriod(year: number, month: number): Promise<ValidationSummary>;
}
export const SAFT_VALIDATION_SERVICE = Symbol('Saft.ValidationService');
