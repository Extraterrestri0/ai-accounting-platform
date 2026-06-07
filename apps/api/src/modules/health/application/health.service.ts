import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../platform';
import { validateEnv } from '../../../config/env.schema';
import { SaftQueueMonitor } from './saft-queue.monitor';

export interface ComponentHealth { status: 'up' | 'down' | 'degraded' | 'disabled'; detail?: string; latencyMs?: number; }
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
    private readonly saftQueue: SaftQueueMonitor,
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

  /**
   * SAF-T async pipeline health (operational, soft-fail). Signals from Redis/BullMQ only:
   *   - 'disabled'  → no REDIS_URL (queue/worker not in use)
   *   - 'down'      → Redis unreachable
   *   - 'degraded'  → no workers connected with a backlog, or jobs stuck queued/processing, or DLQ non-empty
   *   - 'up'        → reachable and healthy
   */
  async saftQueueHealth(): Promise<ComponentHealth> {
    if (!this.saftQueue.available()) return { status: 'disabled', detail: 'REDIS_URL not configured' };
    const t = Date.now();
    if (!(await this.saftQueue.redisReachable())) return { status: 'down', detail: 'redis unreachable', latencyMs: Date.now() - t };
    try {
      const s = await this.saftQueue.stats();
      if (!s) return { status: 'disabled' };
      const issues: string[] = [];
      if (s.workers === 0 && s.waiting + s.active > 0) issues.push('no workers running with backlog');
      if (s.stuckQueued > 0) issues.push(`${s.stuckQueued} stuck queued`);
      if (s.stuckProcessing > 0) issues.push(`${s.stuckProcessing} stuck processing`);
      if (s.failed > 0) issues.push(`${s.failed} failed (DLQ)`);
      const detail = `workers=${s.workers} waiting=${s.waiting} active=${s.active} failed=${s.failed}` + (issues.length ? ` — ${issues.join('; ')}` : '');
      return { status: issues.length ? 'degraded' : 'up', detail, latencyMs: Date.now() - t };
    } catch (e) { return { status: 'down', detail: (e as Error).message, latencyMs: Date.now() - t }; }
  }

  /** Readiness = safe to receive traffic: env + DB + storage all up. */
  async readiness(): Promise<HealthReport> {
    const [db, storage] = await Promise.all([this.database(), this.storageHealth()]);
    const env = this.envHealth();
    const checks = { env, database: db, storage };
    const anyDown = Object.values(checks).some((c) => c.status === 'down');
    return { status: anyDown ? 'down' : 'ok', uptimeSec: this.uptime(), checks };
  }

  /** Overall health for dashboards: ok / degraded (storage or queue soft-fail) / down (DB). */
  async health(): Promise<HealthReport> {
    const r = await this.readiness();
    const saftQueue = await this.saftQueueHealth();
    const checks: Record<string, ComponentHealth> = { ...r.checks, saftQueue };
    if (checks.database.status === 'down') return { ...r, checks, status: 'down' };
    if (checks.storage.status === 'down' || saftQueue.status === 'down' || saftQueue.status === 'degraded') return { ...r, checks, status: 'degraded' };
    return { ...r, checks, status: 'ok' };
  }

  private uptime(): number { return Math.floor((Date.now() - this.startedAt) / 1000); }
}
