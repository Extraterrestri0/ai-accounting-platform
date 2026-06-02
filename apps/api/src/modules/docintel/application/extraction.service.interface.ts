import type { ApplicationService } from '../../../shared-kernel';
import type { DocumentExtraction, ReviewPackage } from '../domain/extraction/models';

/** PUBLIC extraction service — consumed by the Rules Engine (009) and Review Queue (010). */
export interface IExtractionService extends ApplicationService {
  /** Worker/manual entrypoint: OCR or XML → validate → score → persist (idempotent per active run). */
  runExtraction(documentId: string): Promise<DocumentExtraction>;
  getExtraction(documentId: string): Promise<DocumentExtraction | null>;
  /** Review-ready output (fields + confidence + validation + flags). */
  getReviewPackage(documentId: string): Promise<ReviewPackage>;
}
export const EXTRACTION_SERVICE = Symbol('DocIntel.ExtractionService');
