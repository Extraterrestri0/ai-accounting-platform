import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../../../platform/queue/redis.connection';
import type { ExtractionQueue } from '../application/extraction-queue.port';

/** Production extraction queue — enqueues a Redis-backed BullMQ job for the worker. */
@Injectable()
export class RedisExtractionQueue implements ExtractionQueue {
  private readonly log = new Logger('ExtractionQueue');
  private readonly queue = new Queue(QUEUE_NAMES.extraction, { connection: getRedisConnection() });
  async enqueue(input: { documentId: string; tenantId: string; companyId: string }): Promise<void> {
    await this.queue.add('extract', input, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    this.log.log(`queued extraction job for document ${input.documentId}`);
  }
}
