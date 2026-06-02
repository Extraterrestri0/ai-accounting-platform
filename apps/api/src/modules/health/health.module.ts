import { Module } from '@nestjs/common';
import { HealthController } from './api/health.controller';
import { HealthService, STORAGE_HEALTH_PROBE } from './application/health.service';
import { LocalStorageProbe } from './application/local-storage.probe';
import { StartupValidationService } from './application/startup-validation.service';

/** Health + readiness/liveness + fail-fast startup validation. PG_POOL comes from the global PlatformModule. */
@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    StartupValidationService,
    { provide: STORAGE_HEALTH_PROBE, useClass: LocalStorageProbe },
  ],
  exports: [HealthService],
})
export class HealthModule {}
