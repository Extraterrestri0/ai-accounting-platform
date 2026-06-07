import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { STORAGE_SERVICE, type StorageService } from '../../docintel';
import { SaftRepository } from '../infrastructure/saft.repository';
import { SAFT_DATASET_BUILDER, type ISaftDatasetBuilder } from './saft-dataset.builder.interface';
import { SAFT_VALIDATION_SERVICE, type ISaftValidationService } from './saft-validation.service.interface';
import { SAFT_EXPORT_QUEUE, type SaftExportQueue } from './saft-export-queue.port';
import { SAFT_XSD_VALIDATOR, type SaftXsdValidator } from './saft-xsd-validator.port';
import { buildSaftXml } from '../domain/saft-xml.builder';
import {
  saftExportRequested, saftExportCompleted, saftExportFailed,
  saftXmlRenderDuration, saftValidationDuration, saftStorageWriteDuration,
  logSaft, safeErrorName,
} from '../../../platform/observability';
import { SaftEvents } from '../events';
import type { SaftDataset, SaftExportRecord } from '../domain/models';
import type { ISaftExportService, SaftDownloadInfo } from './saft-export.service.interface';

const DOWNLOAD_TTL_SECONDS = 300;

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
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(SAFT_XSD_VALIDATOR) private readonly xsd: SaftXsdValidator,
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
    saftExportRequested.inc();
    logSaft('log', { event: 'saft.requested', exportId: id, tenantId, companyId, year, month, status: 'queued' });
    return (await this.getExport(id))!;
  }

  /** Worker body — runs under the job's restored tenant/company context (system actor, no human). */
  async processExport(exportId: string): Promise<void> {
    const { tenantId, companyId } = this.scope();
    const claimed = await this.db.run((db) => this.repo.claimForProcessing(db, exportId));
    if (!claimed) {
      logSaft('warn', { event: 'saft.skipped', exportId, tenantId, companyId, status: 'not_claimable' });
      this.log.warn(`SAF-T export ${exportId} not claimable (already processing/completed) — skipping`);
      return;
    }

    const rec = await this.db.run((db) => this.repo.getExport(db, exportId));
    if (!rec) throw new NotFoundException(`SAF-T export ${exportId} not found.`);

    try {
      // 1) build dataset + deterministic dataset validation (v1)
      const dataset = await this.builder.buildDataset(rec.year, rec.month);
      const summary = this.validation.validateDataset(dataset);
      // 2) render XML (Phase 3) and XSD-validate it (Phase 4 — inert ⇒ ok:null), timed
      const renderTimer = saftXmlRenderDuration.startTimer();
      const xml = buildSaftXml(dataset);
      const renderMs = Math.round(renderTimer() * 1000);
      const validationTimer = saftValidationDuration.startTimer();
      const xsd = await this.xsd.validate(xml);
      const validationMs = Math.round(validationTimer() * 1000);
      // 3) write the artifact to storage. WORM only when not schema-INVALID (don't lock junk for years).
      const bytes = Buffer.from(xml, 'utf8');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const artifactId = randomUUID();
      const mm = String(rec.month).padStart(2, '0');
      const storageKey = `saft/${companyId}/${rec.year}-${mm}/${exportId}/${artifactId}.xml`;
      const storageTimer = saftStorageWriteDuration.startTimer();
      const put = await this.storage.putObject(storageKey, bytes, 'application/xml', { worm: xsd.ok !== false });
      const storageWriteMs = Math.round(storageTimer() * 1000);
      // 4) persist completion + artifact + audit, atomically
      await this.db.run(async (db) => {
        await this.repo.markCompleted(db, exportId, { datasetJson: dataset, validationSummary: summary, xsdValid: xsd.ok, schemaVersion: xsd.schemaVersion });
        await this.repo.insertArtifact(db, tenantId, companyId, {
          id: artifactId, exportId, kind: 'xml', storageKey, contentType: 'application/xml',
          sizeBytes: put.sizeBytes, sha256, xsdValid: xsd.ok, xsdErrors: xsd.errors, wormRetainUntil: put.retainUntil,
        });
        await this.audit.append(db, { companyId, actorType: 'system', action: SaftEvents.ExportGenerated, entityType: 'saft_export', entityId: exportId, after: { year: rec.year, month: rec.month, counts: dataset.counts, validation: summary.counts, xsd: { ok: xsd.ok, errors: xsd.errors.length, schemaVersion: xsd.schemaVersion }, artifact: { storageKey, sizeBytes: put.sizeBytes, sha256 } } });
      });
      saftExportCompleted.inc({ xsd_valid: String(xsd.ok) });
      logSaft('log', { event: 'saft.completed', exportId, tenantId, companyId, year: rec.year, month: rec.month, status: 'completed', xsdValid: xsd.ok, xsdErrorCount: xsd.errors.length, glEntries: dataset.counts.glEntries, sizeBytes: put.sizeBytes, renderMs, validationMs, storageWriteMs });
      this.log.log(`SAF-T export ${exportId} completed (${rec.year}-${mm}, xsd_valid=${xsd.ok})`);
    } catch (e) {
      const msg = (e as Error).message;
      await this.db.run(async (db) => {
        await this.repo.markFailed(db, exportId, msg);
        await this.audit.append(db, { companyId, actorType: 'system', action: SaftEvents.ExportFailed, entityType: 'saft_export', entityId: exportId, after: { year: rec.year, month: rec.month, error: msg } });
      });
      saftExportFailed.inc();
      logSaft('error', { event: 'saft.failed', exportId, tenantId, companyId, year: rec.year, month: rec.month, status: 'failed', errorName: safeErrorName(e) });
      throw e; // surface to BullMQ for retry/backoff; claim allows failed → processing on retry
    }
  }

  async getDownloadUrl(exportId: string): Promise<SaftDownloadInfo | null> {
    const { companyId } = this.scope();
    const art = await this.db.run((db) => this.repo.latestArtifact(db, exportId, 'xml'));
    if (!art) return null;
    const url = await this.storage.getDownloadUrl(art.storageKey, DOWNLOAD_TTL_SECONDS);
    // Issuing a download credential for a tax artifact is a sensitive, auditable access action.
    await this.db.run((db) => this.audit.append(db, { companyId, ...this.actor(), action: SaftEvents.ExportDownloaded, entityType: 'saft_export', entityId: exportId, after: { artifactId: art.id, storageKey: art.storageKey } }));
    return { url, filename: `saft-${exportId}.xml`, expiresInSeconds: DOWNLOAD_TTL_SECONDS };
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
