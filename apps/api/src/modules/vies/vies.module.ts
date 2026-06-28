import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { ViesController } from './api/vies.controller';
import { VIES_SERVICE } from './application/vies.service.interface';
import { ViesService } from './application/vies.service';
import { VIES_PROVIDER } from './application/vies.provider';
import { ViesRepository } from './infrastructure/vies.repository';
import { createViesProvider } from './infrastructure/vies-provider.factory';

/**
 * VIES bounded context (Task 4.2). Public surface: VIES_SERVICE. Validates EU VAT
 * numbers (cache-first), stores results in vies_checks, exposes counterparty status,
 * and builds the monthly VIES declaration dataset from issued intra-community invoices
 * (read-model over invoices/counterparties — no changes to those modules). The VIES
 * provider is config-selected (live EU endpoint vs deterministic format fallback).
 */
@Module({
  imports: [AuditModule],
  controllers: [ViesController],
  providers: [
    { provide: VIES_SERVICE, useClass: ViesService },
    { provide: VIES_PROVIDER, useFactory: () => createViesProvider() },
    ViesRepository,
  ],
  exports: [VIES_SERVICE],
})
export class ViesModule {}
