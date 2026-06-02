import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { DocumentRepository } from '../infrastructure/document.repository';
import { STORAGE_SERVICE, type StorageService } from './storage.port';
import { MALWARE_SCAN_QUEUE, type MalwareScanQueue } from './scan.port';
import {
  DocumentNotFoundError, FileTooLargeError, FileTypeMismatchError, InvalidDocumentStateError, UnsupportedFileTypeError,
} from '../domain/errors';
import { detectFileType, extensionOf, isAllowedExtension, MAX_UPLOAD_BYTES } from '../domain/validation/file-type';
import { DocIntelEvents } from '../events';
import type { Document, DocumentWithMeta } from '../domain/models';
import type {
  FinalizeUploadInput, IDocumentService, InitiateUploadInput, InitiateUploadResult, ListDocumentsQuery,
} from './document.service.interface';

const DOWNLOAD_TTL = 300; // 5 minutes

@Injectable()
export class DocumentService implements IDocumentService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: DocumentRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(MALWARE_SCAN_QUEUE) private readonly scanQueue: MalwareScanQueue,
    @Inject(AUDIT_SERVICE) private readonly audit: IAuditService,
  ) {}

  private scope() {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new InvalidDocumentStateError('No active company in context.');
    return { tenantId: c.tenantId, companyId: c.companyId, userId: c.userId };
  }

  async initiateUpload(input: InitiateUploadInput): Promise<InitiateUploadResult> {
    const { tenantId, companyId, userId } = this.scope();
    // declared validations (cheap, before allocating storage)
    const ext = extensionOf(input.filename);
    if (!isAllowedExtension(ext)) throw new UnsupportedFileTypeError(ext || input.mimeType);
    if (input.declaredSizeBytes <= 0 || input.declaredSizeBytes > MAX_UPLOAD_BYTES) throw new FileTooLargeError(input.declaredSizeBytes, MAX_UPLOAD_BYTES);

    return this.db.run(async (db) => {
      const safeName = input.filename.replace(/[^\w.\-]/g, '_');
      const tmpKey = `${tenantId}/${companyId}/pending/${safeName}`;
      const doc = await this.repo.createPending(db, tenantId, companyId, {
        filename: input.filename, mimeType: input.mimeType, sizeBytes: input.declaredSizeBytes, storageKey: tmpKey, uploadedBy: userId,
      });
      const finalKey = `${tenantId}/${companyId}/${doc.id}/${safeName}`;
      await db.query(`UPDATE documents SET storage_key=$2 WHERE id=$1`, [doc.id, finalKey]);
      await this.repo.upsertMetadata(db, tenantId, companyId, { documentId: doc.id });
      const uploadTarget = await this.storage.createUploadTarget(finalKey, input.mimeType);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'document.upload_initiated', entityType: 'document', entityId: doc.id, after: { filename: input.filename, mimeType: input.mimeType, sizeBytes: input.declaredSizeBytes } });
      return { document: { ...doc, storageKey: finalKey }, uploadTarget };
    });
  }

  async finalizeUpload(documentId: string, input: FinalizeUploadInput): Promise<Document> {
    const { tenantId, companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const doc = await this.repo.getById(db, documentId);
      if (!doc) throw new DocumentNotFoundError(documentId);
      if (doc.status !== 'pending_upload') throw new InvalidDocumentStateError(`Document ${documentId} is not awaiting upload (status ${doc.status}).`);
      const key = doc.storageKey!;

      const head = await this.storage.headObject(key);
      if (!head.exists) throw new InvalidDocumentStateError('Uploaded object not found in storage.');
      if (head.sizeBytes > MAX_UPLOAD_BYTES) throw new FileTooLargeError(head.sizeBytes, MAX_UPLOAD_BYTES);

      // deterministic content validation via magic bytes
      const prefix = await this.storage.readPrefix(key, 16);
      const detected = detectFileType(prefix);
      if (!detected) throw new FileTypeMismatchError();

      // apply WORM immutability, then record an immutable version + advance status
      await this.storage.finalizeObject(key);
      const versionNo = await this.repo.nextVersionNo(db, documentId);
      await this.repo.addVersion(db, tenantId, companyId, { documentId, versionNo, storageKey: key, checksum: input.checksumSha256, sizeBytes: head.sizeBytes });
      await this.repo.upsertMetadata(db, tenantId, companyId, { documentId, detectedType: detected });
      const uploaded = await this.repo.setStatus(db, documentId, 'scanning', { checksum: input.checksumSha256, sizeBytes: head.sizeBytes });

      await this.scanQueue.enqueue({ documentId, tenantId, companyId, storageKey: key });
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: DocIntelEvents.DocumentReceived, entityType: 'document', entityId: documentId, after: { detectedType: detected, sizeBytes: head.sizeBytes, checksum: input.checksumSha256, version: versionNo } });
      return uploaded;
    });
  }

  async recordScanResult(documentId: string, result: 'clean' | 'infected' | 'error', engine: string): Promise<void> {
    const { tenantId, companyId } = this.scope();
    await this.db.run(async (db) => {
      const doc = await this.repo.getById(db, documentId);
      if (!doc) throw new DocumentNotFoundError(documentId);
      const status = result === 'clean' ? 'ready' : result === 'infected' ? 'quarantined' : 'failed';
      await this.repo.upsertMetadata(db, tenantId, companyId, { documentId, scanStatus: result, scanEngine: engine, scannedAt: true });
      await this.repo.setStatus(db, documentId, status);
      await this.audit.append(db, { companyId, actorType: 'system', action: 'document.scanned', entityType: 'document', entityId: documentId, after: { result, engine, status } });
    });
  }

  async listDocuments(q: ListDocumentsQuery) {
    this.scope();
    const page = Math.max(1, q.page ?? 1); const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const { items, total } = await this.db.run((db) => this.repo.list(db, { status: q.status, type: q.type, search: q.search, limit: pageSize, offset: (page - 1) * pageSize }));
    return { items, total, page, pageSize };
  }

  async getDocument(documentId: string): Promise<DocumentWithMeta> {
    this.scope();
    return this.db.run(async (db) => {
      const doc = await this.repo.getById(db, documentId);
      if (!doc) throw new DocumentNotFoundError(documentId);
      const metadata = await this.repo.getMetadata(db, documentId);
      return { ...doc, metadata: metadata ?? undefined };
    });
  }

  async getDownloadUrl(documentId: string): Promise<string> {
    this.scope();
    const doc = await this.db.run((db) => this.repo.getById(db, documentId));
    if (!doc || !doc.storageKey) throw new DocumentNotFoundError(documentId);
    if (doc.status === 'quarantined') throw new InvalidDocumentStateError('Document is quarantined and cannot be downloaded.');
    return this.storage.getDownloadUrl(doc.storageKey, DOWNLOAD_TTL);
  }
}
