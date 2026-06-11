import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseContextService, TenantContextService } from '../../../platform';
import { AUDIT_SERVICE, type IAuditService } from '../../audit';
import { DocumentRepository } from '../infrastructure/document.repository';
import { STORAGE_SERVICE, type StorageService } from './storage.port';
import { MALWARE_SCAN_QUEUE, type MalwareScanQueue } from './scan.port';
import {
  DocumentNotFoundError, FileTooLargeError, FileTypeMismatchError, InvalidDocumentStateError,
  ScanQueueUnavailableError, UnsupportedFileTypeError,
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
  private readonly log = new Logger('DocumentService');
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

    // 1) Validate + durably persist the upload as 'scanning' (committed). Independent of the
    //    queue so a transient Redis outage cannot roll back the immutable version/audit rows.
    const uploaded = await this.db.run(async (db) => {
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
      const u = await this.repo.setStatus(db, documentId, 'scanning', { checksum: input.checksumSha256, sizeBytes: head.sizeBytes });
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: DocIntelEvents.DocumentReceived, entityType: 'document', entityId: documentId, after: { detectedType: detected, sizeBytes: head.sizeBytes, checksum: input.checksumSha256, version: versionNo } });
      return { doc: u, key };
    });

    // 2) Enqueue the scan AFTER the document is persisted. If the queue is unreachable, mark the
    //    document recoverable-'failed' and surface a clear 503 — never leave it silently stuck in
    //    'scanning' with no job to advance it (the client can retry, or re-run via requeueScan).
    try {
      await this.scanQueue.enqueue({ documentId, tenantId, companyId, storageKey: uploaded.key });
      return uploaded.doc;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.log.error(`scan enqueue failed for ${documentId}: ${reason}`);
      await this.db.run(async (db) => {
        await this.repo.setStatus(db, documentId, 'failed');
        await this.audit.append(db, { companyId, actorType: 'system', action: 'document.scan_enqueue_failed', entityType: 'document', entityId: documentId, after: { status: 'failed', reason } });
      });
      throw new ServiceUnavailableException(new ScanQueueUnavailableError(reason).message);
    }
  }

  /**
   * Re-enqueue the malware scan for a document stuck in 'scanning' or recovered from 'failed'
   * (e.g. the queue was down at upload time). Infra recovery only — touches no ledger/money path.
   */
  async requeueScan(documentId: string): Promise<Document> {
    const { tenantId, companyId, userId } = this.scope();
    const doc = await this.db.run((db) => this.repo.getById(db, documentId));
    if (!doc) throw new DocumentNotFoundError(documentId);
    if (doc.status !== 'scanning' && doc.status !== 'failed') throw new InvalidDocumentStateError(`Document ${documentId} cannot be rescanned (status ${doc.status}).`);
    if (!doc.storageKey) throw new InvalidDocumentStateError('Document has no stored file to scan.');
    try {
      await this.scanQueue.enqueue({ documentId, tenantId, companyId, storageKey: doc.storageKey });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.log.error(`scan re-enqueue failed for ${documentId}: ${reason}`);
      throw new ServiceUnavailableException(new ScanQueueUnavailableError(reason).message);
    }
    return this.db.run(async (db) => {
      const updated = await this.repo.setStatus(db, documentId, 'scanning');
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'document.scan_requeued', entityType: 'document', entityId: documentId, before: { status: doc.status }, after: { status: 'scanning' } });
      return updated;
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

  /** Move a document to the trash (recoverable). */
  async trashDocument(documentId: string): Promise<Document> {
    const { companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const doc = await this.repo.getById(db, documentId);
      if (!doc) throw new DocumentNotFoundError(documentId);
      if (doc.status === 'deleted') throw new InvalidDocumentStateError('Document has been permanently deleted.');
      const updated = await this.repo.trash(db, documentId);
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'document.trashed', entityType: 'document', entityId: documentId, before: { status: doc.status }, after: { status: 'trashed' } });
      return updated;
    });
  }

  /** Restore a document from the trash. */
  async restoreDocument(documentId: string): Promise<Document> {
    const { companyId, userId } = this.scope();
    return this.db.run(async (db) => {
      const doc = await this.repo.getById(db, documentId);
      if (!doc) throw new DocumentNotFoundError(documentId);
      if (doc.status !== 'trashed') throw new InvalidDocumentStateError('Only trashed documents can be restored.');
      const updated = await this.repo.setStatus(db, documentId, 'ready');
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'document.restored', entityType: 'document', entityId: documentId, before: { status: 'trashed' }, after: { status: 'ready' } });
      return updated;
    });
  }

  /**
   * Permanently delete: remove the stored file bytes and tombstone the record (status='deleted').
   * The immutable document_versions + hash-chained audit trail are RETAINED for compliance.
   */
  async purgeDocument(documentId: string): Promise<void> {
    const { companyId, userId } = this.scope();
    const key = await this.db.run(async (db) => {
      const doc = await this.repo.getById(db, documentId);
      if (!doc) throw new DocumentNotFoundError(documentId);
      if (doc.status !== 'trashed' && doc.status !== 'deleted') throw new InvalidDocumentStateError('Move the document to the trash before permanently deleting it.');
      return doc.storageKey;
    });
    if (key) { try { await this.storage.deleteObject(key); } catch { /* bytes already gone */ } }
    await this.db.run(async (db) => {
      await this.repo.setStatus(db, documentId, 'deleted');
      await this.audit.append(db, { companyId, actorType: 'user', actorId: userId, action: 'document.purged', entityType: 'document', entityId: documentId, after: { status: 'deleted', bytesPurged: true } });
    });
  }
}
