import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { MasterDataModule } from '../masterdata';
import { LedgerModule } from '../ledger';
import { PeriodsModule } from '../periods';
import { DocumentsController } from './api/documents.controller';
import { ExtractionsController } from './api/extractions.controller';
import { DevStorageController } from './api/dev-storage.controller';
import { SuggestionsController } from './api/suggestions.controller';
import { ReviewsController } from './api/reviews.controller';
import { PostingsController } from './api/postings.controller';
import { DOCUMENT_SERVICE } from './application/document.service.interface';
import { DocumentService } from './application/document.service';
import { EXTRACTION_SERVICE } from './application/extraction.service.interface';
import { ExtractionService } from './application/extraction.service';
import { RULES_ENGINE_SERVICE } from './application/rules-engine.service.interface';
import { RulesEngineService } from './application/rules-engine.service';
import { ExpenseClassificationService } from './application/expense-classification.service';
import { REVIEW_SERVICE } from './application/review.service.interface';
import { ReviewService } from './application/review.service';
import { POSTING_SERVICE } from './application/posting.service.interface';
import { PostingService } from './application/posting.service';
import { STORAGE_SERVICE } from './application/storage.port';
import { MALWARE_SCAN_QUEUE } from './application/scan.port';
import { OCR_PROVIDER } from './application/ocr.port';
import { EXTRACTION_QUEUE } from './application/extraction-queue.port';
import { DocumentRepository } from './infrastructure/document.repository';
import { ExtractionRepository } from './infrastructure/extraction.repository';
import { RuleRepository } from './infrastructure/rule.repository';
import { SuggestionRepository } from './infrastructure/suggestion.repository';
import { ReviewRepository } from './infrastructure/review.repository';
import { PostingRepository } from './infrastructure/posting.repository';
import { LocalObjectStorage } from './infrastructure/local-object-storage';
import { S3ObjectStorage } from './infrastructure/s3-object-storage';
import { InMemoryScanQueue } from './infrastructure/inmemory-scan-queue';
import { RedisScanQueue } from './infrastructure/redis-scan-queue';
import { createOcrProvider } from './infrastructure/ocr-provider.factory';
import { InMemoryExtractionQueue } from './infrastructure/inmemory-extraction-queue';
import { RedisExtractionQueue } from './infrastructure/redis-extraction-queue';

/**
 * DocIntel — upload (007) + OCR/extraction (008) + rules engine (009).
 * The rules engine consumes extractions + master data → accounting/VAT SUGGESTIONS.
 * AI may suggest but NEVER posts (no ledger dependency; audited as actor 'ai'). Invariant 4/5.
 */
@Module({
  imports: [AuditModule, MasterDataModule, LedgerModule, PeriodsModule],
  controllers: [DocumentsController, DevStorageController, ExtractionsController, SuggestionsController, ReviewsController, PostingsController],
  providers: [
    { provide: DOCUMENT_SERVICE, useClass: DocumentService },
    { provide: EXTRACTION_SERVICE, useClass: ExtractionService },
    ExpenseClassificationService,
    { provide: RULES_ENGINE_SERVICE, useClass: RulesEngineService },
    { provide: REVIEW_SERVICE, useClass: ReviewService },
    { provide: POSTING_SERVICE, useClass: PostingService },
    { provide: STORAGE_SERVICE, useClass: process.env.STORAGE_DRIVER === 'local' ? LocalObjectStorage : ((process.env.STORAGE_ENDPOINT || process.env.STORAGE_ACCESS_KEY) ? S3ObjectStorage : LocalObjectStorage) },
    { provide: MALWARE_SCAN_QUEUE, useClass: process.env.REDIS_URL ? RedisScanQueue : InMemoryScanQueue },
    { provide: OCR_PROVIDER, useFactory: () => createOcrProvider() },
    { provide: EXTRACTION_QUEUE, useClass: process.env.REDIS_URL ? RedisExtractionQueue : InMemoryExtractionQueue },
    DocumentRepository, ExtractionRepository, RuleRepository, SuggestionRepository, ReviewRepository, PostingRepository,
  ],
  exports: [DOCUMENT_SERVICE, EXTRACTION_SERVICE, RULES_ENGINE_SERVICE, REVIEW_SERVICE, POSTING_SERVICE, EXTRACTION_QUEUE, STORAGE_SERVICE],
})
export class DocIntelModule {}
