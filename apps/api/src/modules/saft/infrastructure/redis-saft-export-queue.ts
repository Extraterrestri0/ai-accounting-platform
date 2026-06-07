import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../../../platform/queue/redis.connection';
import type { SaftExportQueue } from '../application/saft-export-queue.port';

/**
 * Production SAF-T export queue — enqueues a Redis-backed BullMQ job for the worker.
 * jobId = exportId makes enqueue idempotent (BullMQ de-dupes the same export job).
 */
@Injectable()
export class RedisSaftExportQueue implements SaftExportQueue {
  private readonly log = new Logger('SaftExportQueue');
  private readonly queue = new Queue(QUEUE_NAMES.saftExport, { connection: getRedisConnection() });
  async enqueue(input: { exportId: string; tenantId: string; companyId: string }): Promise<void> {
    await this.queue.add('export', input, { jobId: input.exportId, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    this.log.log(`queued SAF-T export job ${input.exportId}`);
  }
}
