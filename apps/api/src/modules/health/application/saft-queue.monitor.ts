import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getRedis, getRedisConnection, QUEUE_NAMES } from '../../../platform/queue/redis.connection';
import type { SaftQueueStats } from '../../../platform/observability';

const STUCK_THRESHOLD_MS = Number(process.env.SAFT_STUCK_THRESHOLD_MS ?? 15 * 60 * 1000); // 15 min default
const SAMPLE = 100;

/**
 * Operational monitor for the SAF-T export queue. All signals come from Redis/BullMQ (global,
 * no RLS) — never from the tenant-scoped DB — so "stuck queued/processing", worker liveness,
 * and DLQ depth are observable without crossing tenant isolation. Inert (returns null) when no
 * REDIS_URL is configured (e.g. dev without the queue / flag off).
 */
@Injectable()
export class SaftQueueMonitor implements OnModuleDestroy {
  private readonly log = new Logger('SaftQueueMonitor');
  private readonly queue: Queue | null;

  constructor() {
    this.queue = process.env.REDIS_URL ? new Queue(QUEUE_NAMES.saftExport, { connection: getRedisConnection() }) : null;
  }

  available(): boolean { return !!this.queue; }

  async redisReachable(): Promise<boolean> {
    if (!process.env.REDIS_URL) return false;
    try { await getRedis().ping(); return true; } catch { return false; }
  }

  /** Snapshot of queue health, or null when the queue is not configured. */
  async stats(): Promise<SaftQueueStats | null> {
    if (!this.queue) return null;
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    const workers = (await this.queue.getWorkers()).length;
    const [waitingJobs, activeJobs] = await Promise.all([
      this.queue.getJobs(['waiting'], 0, SAMPLE),
      this.queue.getJobs(['active'], 0, SAMPLE),
    ]);
    const now = Date.now();
    const stuckQueued = waitingJobs.filter((j) => j && now - j.timestamp > STUCK_THRESHOLD_MS).length;
    const stuckProcessing = activeJobs.filter((j) => j && j.processedOn && now - j.processedOn > STUCK_THRESHOLD_MS).length;
    return {
      waiting: counts.waiting ?? 0, active: counts.active ?? 0, delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0, completed: counts.completed ?? 0,
      workers, stuckQueued, stuckProcessing,
    };
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.queue?.close(); } catch { /* ignore */ }
  }
}
