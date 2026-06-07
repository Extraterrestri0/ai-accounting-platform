import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { SaftRepository } from '../infrastructure/saft.repository';
import { SAFT_DATASET_BUILDER, type ISaftDatasetBuilder } from './saft-dataset.builder.interface';
import { SAFT_VALIDATION_SERVICE, type ISaftValidationService } from './saft-validation.service.interface';
import { SaftEvents } from '../events';
import type { SaftDataset, SaftExportRecord } from '../domain/models';
import type { ISaftExportService } from './saft-export.service.interface';

@Injectable()
export class SaftExportService implements ISaftExportService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: SaftRepository,
    @Inject(SAFT_DATASET_BUILDER) private readonly builder: ISaftDatasetBuilder,
    @Inject(SAFT_VALIDATION_SERVICE) private readonly validation: ISaftValidationService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new BadRequestException('No active company selected.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }
  private actor() { const { userId } = this.scope(); return { actorType: (userId ? 'user' : 'system') as 'user' | 'system', actorId: userId }; }

  async generateExport(year: number, month: number): Promise<SaftExportRecord> {
    const { tenantId, companyId } = this.scope();
    await this.db.run((db) => this.audit.append(db, { companyId, ...this.actor(), action: SaftEvents.ExportRequested, entityType: 'saft_export', after: { year, month } }));

    try {
      const dataset = await this.builder.buildDataset(year, month);
      const summary = this.validation.validateDataset(dataset);
      const id = await this.db.run(async (db) => {
        const exportId = await this.repo.insertExport(db, tenantId, companyId, { year, month, status: 'generated', generatedBy: this.actor().actorId, datasetJson: dataset, validationSummary: summary });
        await this.audit.append(db, { companyId, ...this.actor(), action: SaftEvents.ExportGenerated, entityType: 'saft_export', entityId: exportId, after: { year, month, counts: dataset.counts, validation: summary.counts } });
        return exportId;
      });
      return (await this.getExport(id))!;
    } catch (e) {
      const msg = (e as Error).message;
      const id = await this.db.run(async (db) => {
        const exportId = await this.repo.insertExport(db, tenantId, companyId, { year, month, status: 'failed', generatedBy: this.actor().actorId, datasetJson: null, validationSummary: null, error: msg });
        await this.audit.append(db, { companyId, ...this.actor(), action: SaftEvents.ExportFailed, entityType: 'saft_export', entityId: exportId, after: { year, month, error: msg } });
        return exportId;
      });
      return (await this.getExport(id))!;
    }
  }

  getExport(id: string): Promise<SaftExportRecord | null> {
    this.scope();
    return this.db.run((db) => this.repo.getExport(db, id));
  }

  listExports(page = 1, pageSize = 50): Promise<SaftExportRecord[]> {
    const { companyId } = this.scope();
    const size = Math.min(200, Math.max(1, pageSize));
    return this.db.run((db) => this.repo.listExports(db, companyId, size, (Math.max(1, page) - 1) * size));
  }

  async getExportDataset(id: string): Promise<SaftDataset | null> {
    this.scope();
    const ds = await this.db.run((db) => this.repo.getExportDataset(db, id));
    return (ds as SaftDataset | null) ?? null;
  }
}
