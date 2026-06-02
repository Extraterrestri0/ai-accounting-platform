import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { assertEnv } from '../../../config/env.schema';
import { HealthService } from './health.service';

/** Fail-fast startup checks: env must be valid; DB must connect. Storage is logged but non-fatal. */
@Injectable()
export class StartupValidationService implements OnApplicationBootstrap {
  private readonly log = new Logger('Startup');
  constructor(private readonly health: HealthService) {}

  async onApplicationBootstrap(): Promise<void> {
    assertEnv(); // throws → process exits non-zero
    const db = await this.health.database();
    if (db.status === 'down') throw new Error(`Database connectivity check failed: ${db.detail}`);
    const storage = await this.health.storageHealth();
    if (storage.status === 'down') this.log.warn(`Storage probe down at startup: ${storage.detail}`);
    this.log.log(`Startup validation passed (db ${db.latencyMs}ms, storage ${storage.status}).`);
  }
}
