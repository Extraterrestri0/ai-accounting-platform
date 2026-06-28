import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../../../platform/queue/redis.connection';
import { enqueueWithTimeout } from '../../../platform/queue/enqueue-timeout';
import type { MalwareScanQueue } from '../application/scan.port';

/** Production malware-scan queue — enqueues a Redis-backed BullMQ job for the worker to consume. */
@Injectable()
export class RedisScanQueue implements MalwareScanQueue {
  private readonly log = new Logger('ScanQueue');
  private readonly queue = new Queue(QUEUE_NAMES.scan, { connection: getRedisConnection() });
  async enqueue(input: { documentId: string; tenantId: string; companyId: string; storageKey: string }): Promise<void> {
    // Bounded so a down Redis surfaces a prompt error instead of hanging the upload request.
    await enqueueWithTimeout(
      this.queue.add('scan', input, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 }),
      'scan enqueue',
    );
    this.log.log(`queued scan job for document ${input.documentId}`);
  }
}
