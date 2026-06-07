import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { SaftRepository } from '../infrastructure/saft.repository';
import { SAFT_DATASET_BUILDER, type ISaftDatasetBuilder } from './saft-dataset.builder.interface';
import { SAFT_VALIDATION_SERVICE, type ISaftValidationService } from './saft-validation.service.interface';
import { SAFT_EXPORT_QUEUE, type SaftExportQueue } from './saft-export-queue.port';
import { SaftEvents } from '../events';
import type { SaftDataset, SaftExportRecord } from '../domain/models';
import type { ISaftExportService } from './saft-export.service.interface';

@Injectable()
export class SaftExportService implements ISaftExportService {
  private readonly log = new Logger('SaftExport');
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: SaftRepository,
    @Inject(SAFT_DATASET_BUILDER) private readonly builder: ISaftDatasetBuilder,
    @Inject(SAFT_VALIDATION_SERVICE) private readonly validation: ISaftValidationService,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
    @Inject(SAFT_EXPORT_QUEUE) private readonly queue: SaftExportQueue,
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

  async requestExport(year: number, month: number): Promise<SaftExportRecord> {
    const { tenantId, companyId, userId } = this.scope();

    // Duplicate-submit protection: reuse an already in-flight export for this period.
    const active = await this.db.run((db) => this.repo.findActiveExport(db, companyId, year, month));
    if (active) { this.log.log(`reusing in-flight SAF-T export ${active.id} for ${year}-${month}`); return active; }

    const id = await this.db.run(async (db) => {
      const exportId = await this.repo.insertQueued(db, tenantId, companyId, { year, month, requestedBy: userId });
      await this.audit.append(db, { companyId, ...this.actor(), action: SaftEvents.ExportRequested, entityType: 'saft_export', entityId: exportId, after: { year, month, mode: 'async' } });
      return exportId;
    });
    // Enqueue AFTER the row+audit commit (jobId = exportId → BullMQ de-dupes re-enqueues).
    await this.queue.enqueue({ exportId: id, tenantId, companyId });
    return (await this.getExport(id))!;
  }

  /** Worker body — runs under the job's restored tenant/company context (system actor, no human). */
  async processExport(exportId: string): Promise<void> {
    const { companyId } = this.scope();
    const claimed = await this.db.run((db) => this.repo.claimForProcessing(db, exportId));
    if (!claimed) { this.log.warn(`SAF-T export ${exportId} not claimable (already processing/completed) — skipping`); return; }

    const rec = await this.db.run((db) => this.repo.getExport(db, exportId));
    if (!rec) throw new NotFoundException(`SAF-T export ${exportId} not found.`);

    try {
      const dataset = await this.builder.buildDataset(rec.year, rec.month);
      const summary = this.validation.validateDataset(dataset);
      await this.db.run(async (db) => {
        await this.repo.markCompleted(db, exportId, { datasetJson: dataset, validationSummary: summary });
        await this.audit.append(db, { companyId, actorType: 'system', action: SaftEvents.ExportGenerated, entityType: 'saft_export', entityId: exportId, after: { year: rec.year, month: rec.month, counts: dataset.counts, validation: summary.counts } });
      });
      this.log.log(`SAF-T export ${exportId} completed (${rec.year}-${rec.month})`);
    } catch (e) {
      const msg = (e as Error).message;
      await this.db.run(async (db) => {
        await this.repo.markFailed(db, exportId, msg);
        await this.audit.append(db, { companyId, actorType: 'system', action: SaftEvents.ExportFailed, entityType: 'saft_export', entityId: exportId, after: { year: rec.year, month: rec.month, error: msg } });
      });
      throw e; // surface to BullMQ for retry/backoff; claim allows failed → processing on retry
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
