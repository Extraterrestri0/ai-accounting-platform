import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { DOCUMENT_SERVICE, type IDocumentService } from './document.service.interface';
import type { IExtractionService } from './extraction.service.interface';
import { STORAGE_SERVICE, type StorageService } from './storage.port';
import { OCR_PROVIDER, type OcrProvider } from './ocr.port';
import { ExtractionRepository } from '../infrastructure/extraction.repository';
import { extractFromText } from '../domain/extraction/field-extractor';
import { extractFromXml } from '../domain/extraction/xml-extractor';
import { applyValidation, overallConfidence, reviewFlags } from '../domain/extraction/confidence';
import { DocIntelEvents } from '../events';
import type { DocumentExtraction, ExtractedField, ReviewPackage, RunMethod } from '../domain/extraction/models';

class ExtractionError extends Error {}

@Injectable()
export class ExtractionService implements IExtractionService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: ExtractionRepository,
    @Inject(DOCUMENT_SERVICE) private readonly documents: IDocumentService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new ExtractionError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId };
  }

  async runExtraction(documentId: string): Promise<DocumentExtraction> {
    const { tenantId, companyId } = this.scope();
    const doc = await this.documents.getDocument(documentId);
    if (doc.status !== 'ready') throw new ExtractionError(`Document ${documentId} is not ready for extraction (status ${doc.status}).`);

    // OCR may extract & suggest — NEVER post (no ledger dependency exists here). Invariant 4.
    const isXml = (doc.metadata?.detectedType ?? '') === 'xml' || doc.mimeType.includes('xml');
    const bytes = await this.storage.readObject(doc.storageKey!);
    let fields: ExtractedField[];
    let method: RunMethod; let engine: string;
    if (isXml) {
      method = 'xml'; engine = 'ubl-xml';
      fields = applyValidation(extractFromXml(bytes.toString('utf8')));
    } else {
      method = 'ocr';
      const ocr = await this.ocr.recognize(bytes, doc.mimeType); engine = ocr.engine;
      fields = applyValidation(extractFromText(ocr.text));
    }
    const overall = overallConfidence(fields);

    return this.db.run(async (db) => {
      if (await this.repo.hasActiveRun(db, documentId)) throw new ExtractionError('An extraction is already in progress for this document.');
      const runId = await this.repo.createRun(db, tenantId, companyId, documentId, method, engine);
      try {
        const extractionId = await this.repo.saveExtraction(db, tenantId, companyId, documentId, runId, 'invoice', overall, fields);
        await this.repo.finishRun(db, runId, 'succeeded', overall);
        // audit as the AI/automated actor (capability-limited identity) — proposes only
        await this.audit.append(db, { companyId, actorType: 'ai', action: DocIntelEvents.ExtractionCompleted, entityType: 'document_extraction', entityId: extractionId, after: { method, engine, overallConfidence: overall, fieldCount: fields.length } });
        return { id: extractionId, documentId, runId, docType: 'invoice', overallConfidence: overall, status: 'extracted', fields };
      } catch (e) {
        await this.repo.finishRun(db, runId, 'failed', null, (e as Error).message);
        throw e;
      }
    });
  }

  getExtraction(documentId: string): Promise<DocumentExtraction | null> {
    this.scope();
    return this.db.run((db) => this.repo.getCurrentExtraction(db, documentId));
  }

  async getReviewPackage(documentId: string): Promise<ReviewPackage> {
    this.scope();
    const ex = await this.db.run((db) => this.repo.getCurrentExtraction(db, documentId));
    if (!ex) throw new ExtractionError(`No extraction found for document ${documentId}.`);
    return { documentId, extractionId: ex.id, docType: ex.docType, overallConfidence: ex.overallConfidence, fields: ex.fields, flags: reviewFlags(ex.fields) };
  }
}
