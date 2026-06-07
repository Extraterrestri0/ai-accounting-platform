import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { MasterDataModule } from '../masterdata';
import { DocIntelModule } from '../docintel';
import { SaftController } from './api/saft.controller';
import { SAFT_DATASET_BUILDER } from './application/saft-dataset.builder.interface';
import { SaftDatasetBuilder } from './application/saft-dataset.builder';
import { SAFT_VALIDATION_SERVICE } from './application/saft-validation.service.interface';
import { SaftValidationService } from './application/saft-validation.service';
import { SAFT_EXPORT_SERVICE } from './application/saft-export.service.interface';
import { SaftExportService } from './application/saft-export.service';
import { SAFT_EXPORT_QUEUE } from './application/saft-export-queue.port';
import { RedisSaftExportQueue } from './infrastructure/redis-saft-export-queue';
import { InMemorySaftExportQueue } from './infrastructure/inmemory-saft-export-queue';
import { SaftRepository } from './infrastructure/saft.repository';
import { FeatureFlags } from '../../config/feature-flags';

/**
 * SAF-T Engine. v1 builds a normalized dataset by READING existing immutable sources.
 * v2 (behind SAFT_XML_ENABLED) adds an async export lifecycle: POST enqueues a BullMQ
 * job and the worker runs an idempotent state machine (queued→processing→completed/failed).
 * A pure read/aggregation context: it never writes the ledger or any source module.
 */
@Module({
  imports: [AuditModule, MasterDataModule, DocIntelModule],
  controllers: [SaftController],
  providers: [
    { provide: SAFT_DATASET_BUILDER, useClass: SaftDatasetBuilder },
    { provide: SAFT_VALIDATION_SERVICE, useClass: SaftValidationService },
    { provide: SAFT_EXPORT_SERVICE, useClass: SaftExportService },
    { provide: SAFT_EXPORT_QUEUE, useClass: process.env.REDIS_URL ? RedisSaftExportQueue : InMemorySaftExportQueue },
    FeatureFlags,
    SaftRepository,
  ],
  exports: [SAFT_EXPORT_SERVICE, SAFT_VALIDATION_SERVICE, SAFT_DATASET_BUILDER, SAFT_EXPORT_QUEUE],
})
export class SaftModule {}
