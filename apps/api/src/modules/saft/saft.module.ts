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
import { SaftRepository } from './infrastructure/saft.repository';

/**
 * SAF-T Engine v1 (SAF-T-ready data). Builds a normalized dataset (Header, Master Files,
 * GL Entries, Source Documents) by READING existing immutable sources — ledger, invoices,
 * purchases, payments/banking, master data — then validates + persists it (no XML yet).
 * A pure read/aggregation context: it never writes the ledger or any source module.
 */
@Module({
  imports: [AuditModule, MasterDataModule, DocIntelModule],
  controllers: [SaftController],
  providers: [
    { provide: SAFT_DATASET_BUILDER, useClass: SaftDatasetBuilder },
    { provide: SAFT_VALIDATION_SERVICE, useClass: SaftValidationService },
    { provide: SAFT_EXPORT_SERVICE, useClass: SaftExportService },
    SaftRepository,
  ],
  exports: [SAFT_EXPORT_SERVICE, SAFT_VALIDATION_SERVICE, SAFT_DATASET_BUILDER],
})
export class SaftModule {}
