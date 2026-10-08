export { DocIntelModule } from './docintel.module';
export * from './application'; // IDocumentService, IExtractionService, IRulesEngineService, IReviewService, ports
export * from './events';
export type { Document, DocumentVersion, DocumentMetadata, DocumentStatus, DetectedType } from './domain/models';
export type { ExtractionResult, DocumentExtraction, ExtractedField, ReviewPackage as ExtractionReviewPackage, FieldKey } from './domain/extraction/models';
export type { AccountingSuggestion, VatSuggestion, PostingLine, SuggestionStatus, VatTreatment, RuleType } from './domain/rules/models';
export type { ReviewPackage, ReviewStatus, ReviewDetail, ReviewQueueItem, ReviewerDashboard, ReviewActionType } from './domain/review/models';
export type { PostingRequest, PostingResult, PostingOutcome, PostingStatus, PostingKind, PostedPurchaseDetail } from './domain/posting/models';
export { detectFileType, MAX_UPLOAD_BYTES } from './domain/validation/file-type';
