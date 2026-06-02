import { Injectable, Logger } from '@nestjs/common';
import type { ExtractionQueue } from '../application/extraction-queue.port';

/** DEV queue — records the job. Prod = BullMQ; the worker calls IExtractionService.runExtraction. */
@Injectable()
export class InMemoryExtractionQueue implements ExtractionQueue {
  private readonly log = new Logger('ExtractionQueue');
  async enqueue(input: { documentId: string; tenantId: string; companyId: string }): Promise<void> {
    this.log.log(`enqueued extraction for document ${input.documentId}`);
  }
}
