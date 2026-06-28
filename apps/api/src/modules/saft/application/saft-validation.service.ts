import { Inject, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../platform';
import { SAFT_DATASET_BUILDER, type ISaftDatasetBuilder } from './saft-dataset.builder.interface';
import { validateDataset } from '../domain/validation';
import type { SaftDataset, ValidationSummary } from '../domain/models';
import type { ISaftValidationService } from './saft-validation.service.interface';

@Injectable()
export class SaftValidationService implements ISaftValidationService {
  constructor(
    private readonly ctx: TenantContextService,
    @Inject(SAFT_DATASET_BUILDER) private readonly builder: ISaftDatasetBuilder,
  ) {}

  /** Pure delegation to the domain validator. */
  validateDataset(dataset: SaftDataset): ValidationSummary {
    return validateDataset(dataset);
  }

  /**
   * Side-effect-free preview validation for a period (used by a GET endpoint).
   * Builds the dataset and runs the pure validator — it does NOT persist anything
   * and does NOT write an audit record. Auditing happens only when an export is
   * actually generated (a POST), where the validation summary is stored with it.
   */
  async validatePeriod(year: number, month: number): Promise<ValidationSummary> {
    this.ctx.currentOrThrow(); // fail-closed: require tenant context
    const dataset = await this.builder.buildDataset(year, month);
    return this.validateDataset(dataset);
  }
}
