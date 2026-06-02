import { Injectable, Logger } from '@nestjs/common';
import type { MalwareScanQueue } from '../application/scan.port';

/**
 * DEV scan queue — records the job. Production = BullMQ → Python ClamAV/vendor worker
 * that calls back IDocumentService.recordScanResult. No auto-clean here (fail-closed:
 * documents stay in 'scanning' until a real result arrives).
 */
@Injectable()
export class InMemoryScanQueue implements MalwareScanQueue {
  private readonly log = new Logger('MalwareScanQueue');
  async enqueue(input: { documentId: string; tenantId: string; companyId: string; storageKey: string }): Promise<void> {
    this.log.log(`enqueued scan for document ${input.documentId} (${input.storageKey})`);
  }
}
