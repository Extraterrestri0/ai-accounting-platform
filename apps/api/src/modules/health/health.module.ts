import { Module } from '@nestjs/common';
import { HealthController } from './api/health.controller';
import { MetricsController } from './api/metrics.controller';
import { HealthService, STORAGE_HEALTH_PROBE } from './application/health.service';
import { LocalStorageProbe } from './application/local-storage.probe';
import { SaftQueueMonitor } from './application/saft-queue.monitor';
import { StartupValidationService } from './application/startup-validation.service';

/** Health + readiness/liveness + Prometheus /metrics + SAF-T queue/worker monitoring. PG_POOL from the global PlatformModule. */
@Module({
  controllers: [HealthController, MetricsController],
  providers: [
    HealthService,
    StartupValidationService,
    SaftQueueMonitor,
    { provide: STORAGE_HEALTH_PROBE, useClass: LocalStorageProbe },
  ],
  exports: [HealthService],
})
export class HealthModule {}
