import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../platform';
import { validateEnv } from '../../../config/env.schema';

export interface ComponentHealth { status: 'up' | 'down'; detail?: string; latencyMs?: number; }
export interface HealthReport { status: 'ok' | 'degraded' | 'down'; uptimeSec: number; checks: Record<string, ComponentHealth>; }

/** Storage health is provided by the storage adapter (Task 007). Kept as a tiny port so the
 *  health module does not depend on the whole document context. */
export interface StorageHealthProbe { ping(): Promise<{ ok: boolean; detail?: string }>; }
export const STORAGE_HEALTH_PROBE = Symbol('Health.StorageProbe');

@Injectable()
export class HealthService {
  private readonly log = new Logger('Health');
  private readonly startedAt = Date.now();
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(STORAGE_HEALTH_PROBE) private readonly storage: StorageHealthProbe,
  ) {}

  liveness(): HealthReport {
    return { status: 'ok', uptimeSec: this.uptime(), checks: { process: { status: 'up' } } };
  }

  async database(): Promise<ComponentHealth> {
    const t = Date.now();
    try { await this.pool.query('SELECT 1'); return { status: 'up', latencyMs: Date.now() - t }; }
    catch (e) { return { status: 'down', detail: (e as Error).message }; }
  }

  async storageHealth(): Promise<ComponentHealth> {
    const t = Date.now();
    try { const r = await this.storage.ping(); return { status: r.ok ? 'up' : 'down', detail: r.detail, latencyMs: Date.now() - t }; }
    catch (e) { return { status: 'down', detail: (e as Error).message }; }
  }

  envHealth(): ComponentHealth {
    const r = validateEnv();
    return r.ok ? { status: 'up' } : { status: 'down', detail: [...r.missing, ...r.weak].join(', ') };
  }

  /** Readiness = safe to receive traffic: env + DB + storage all up. */
  async readiness(): Promise<HealthReport> {
    const [db, storage] = await Promise.all([this.database(), this.storageHealth()]);
    const env = this.envHealth();
    const checks = { env, database: db, storage };
    const anyDown = Object.values(checks).some((c) => c.status === 'down');
    return { status: anyDown ? 'down' : 'ok', uptimeSec: this.uptime(), checks };
  }

  /** Overall health for dashboards: ok / degraded (storage soft-fail) / down (DB). */
  async health(): Promise<HealthReport> {
    const r = await this.readiness();
    if (r.checks.database.status === 'down') return { ...r, status: 'down' };
    if (r.checks.storage.status === 'down') return { ...r, status: 'degraded' };
    return { ...r, status: 'ok' };
  }

  private uptime(): number { return Math.floor((Date.now() - this.startedAt) / 1000); }
}
