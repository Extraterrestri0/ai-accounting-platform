import type { ApplicationService } from '../../../shared-kernel';
import type { Document, DocumentStatus, DocumentWithMeta, DetectedType } from '../domain/models';
import type { UploadTarget } from './storage.port';

export interface InitiateUploadInput { filename: string; mimeType: string; declaredSizeBytes: number; }
export interface InitiateUploadResult { document: Document; uploadTarget: UploadTarget; }
export interface FinalizeUploadInput { checksumSha256: string; }
export interface ListDocumentsQuery { status?: DocumentStatus; type?: DetectedType; search?: string; page?: number; pageSize?: number; }

/** PUBLIC document service — the surface the OCR pipeline (Task 008) consumes. */
export interface IDocumentService extends ApplicationService {
  initiateUpload(input: InitiateUploadInput): Promise<InitiateUploadResult>;
  finalizeUpload(documentId: string, input: FinalizeUploadInput): Promise<Document>;
  /** Scan-worker callback: set ready (clean) or quarantined (infected). */
  recordScanResult(documentId: string, result: 'clean' | 'infected' | 'error', engine: string): Promise<void>;
  /** Re-enqueue the scan for a document stuck in 'scanning'/'failed' (e.g. the queue was down). */
  requeueScan(documentId: string): Promise<Document>;
  listDocuments(q: ListDocumentsQuery): Promise<{ items: DocumentWithMeta[]; total: number; page: number; pageSize: number }>;
  getDocument(documentId: string): Promise<DocumentWithMeta>;
  getDownloadUrl(documentId: string): Promise<string>;
  trashDocument(documentId: string): Promise<Document>;
  restoreDocument(documentId: string): Promise<Document>;
  purgeDocument(documentId: string): Promise<void>;
}
export const DOCUMENT_SERVICE = Symbol('DocIntel.DocumentService');
