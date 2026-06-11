import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getRedis, getRedisConnection, QUEUE_NAMES } from '../../../platform/queue/redis.connection';

const STUCK_THRESHOLD_MS = Number(process.env.DOC_STUCK_THRESHOLD_MS ?? 5 * 60 * 1000); // 5 min default
const SAMPLE = 100;

export interface DocPipelineStats {
  workers: number; waiting: number; active: number; failed: number; stuckQueued: number; stuckProcessing: number;
}

/**
 * Operational monitor for the document scan + extraction queues. Signals come from Redis/BullMQ
 * only (global, no RLS) so "queue down / no workers / stuck jobs" is observable without crossing
 * tenant isolation. Inert (returns null) when no REDIS_URL is configured (dev in-memory queues).
 *
 * Lets the UI proactively warn that the upload→scan→extract pipeline is degraded, instead of a
 * document spinning in 'scanning' with no explanation.
 */
@Injectable()
export class DocPipelineMonitor implements OnModuleDestroy {
  private readonly log = new Logger('DocPipelineMonitor');
  private readonly queues: Queue[] | null;

  constructor() {
    this.queues = process.env.REDIS_URL
      ? [QUEUE_NAMES.scan, QUEUE_NAMES.extraction].map((name) => new Queue(name, { connection: getRedisConnection() }))
      : null;
  }

  available(): boolean { return !!this.queues; }

  async redisReachable(): Promise<boolean> {
    if (!process.env.REDIS_URL) return false;
    try { await getRedis().ping(); return true; } catch { return false; }
  }

  /** Combined snapshot across the scan + extraction queues, or null when not configured. */
  async stats(): Promise<DocPipelineStats | null> {
    if (!this.queues) return null;
    const now = Date.now();
    const per = await Promise.all(this.queues.map(async (q) => {
      const counts = await q.getJobCounts('waiting', 'active', 'failed');
      const workers = (await q.getWorkers()).length;
      const [waitingJobs, activeJobs] = await Promise.all([q.getJobs(['waiting'], 0, SAMPLE), q.getJobs(['active'], 0, SAMPLE)]);
      return {
        workers,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        failed: counts.failed ?? 0,
        stuckQueued: waitingJobs.filter((j) => j && now - j.timestamp > STUCK_THRESHOLD_MS).length,
        stuckProcessing: activeJobs.filter((j) => j && j.processedOn && now - j.processedOn > STUCK_THRESHOLD_MS).length,
      };
    }));
    // workers: min across queues (the pipeline is only healthy if every stage has a consumer).
    return {
      workers: Math.min(...per.map((p) => p.workers)),
      waiting: per.reduce((s, p) => s + p.waiting, 0),
      active: per.reduce((s, p) => s + p.active, 0),
      failed: per.reduce((s, p) => s + p.failed, 0),
      stuckQueued: per.reduce((s, p) => s + p.stuckQueued, 0),
      stuckProcessing: per.reduce((s, p) => s + p.stuckProcessing, 0),
    };
  }

  async onModuleDestroy(): Promise<void> {
    for (const q of this.queues ?? []) { try { await q.close(); } catch { /* ignore */ } }
  }
}
