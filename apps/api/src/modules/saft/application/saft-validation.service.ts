import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { SAFT_DATASET_BUILDER, type ISaftDatasetBuilder } from './saft-dataset.builder.interface';
import { validateDataset } from '../domain/validation';
import { SaftEvents } from '../events';
import type { SaftDataset, ValidationSummary } from '../domain/models';
import type { ISaftValidationService } from './saft-validation.service.interface';

@Injectable()
export class SaftValidationService implements ISaftValidationService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    @Inject(SAFT_DATASET_BUILDER) private readonly builder: ISaftDatasetBuilder,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  /** Pure delegation to the domain validator. */
  validateDataset(dataset: SaftDataset): ValidationSummary {
    return validateDataset(dataset);
  }

  async validatePeriod(year: number, month: number): Promise<ValidationSummary> {
    const c = this.ctx.currentOrThrow();
    const dataset = await this.builder.buildDataset(year, month);
    const summary = this.validateDataset(dataset);
    await this.db.run((db) => this.audit.append(db, {
      companyId: c.companyId, actorType: c.userId ? 'user' : 'system', actorId: c.userId,
      action: SaftEvents.DatasetValidated, entityType: 'saft_export',
      after: { year, month, validation: summary.counts },
    }));
    return summary;
  }
}
