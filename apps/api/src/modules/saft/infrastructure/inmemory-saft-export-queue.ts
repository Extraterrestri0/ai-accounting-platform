import { Injectable, Logger } from '@nestjs/common';
import type { SaftExportQueue } from '../application/saft-export-queue.port';

/**
 * DEV queue — records the job only (no Redis). Prod = BullMQ; the worker calls
 * ISaftExportService.processExport. With this driver the export stays 'queued'
 * until a real worker is wired (matches the extraction-queue dev behavior).
 */
@Injectable()
export class InMemorySaftExportQueue implements SaftExportQueue {
  private readonly log = new Logger('SaftExportQueue');
  async enqueue(input: { exportId: string; tenantId: string; companyId: string }): Promise<void> {
    this.log.log(`enqueued SAF-T export ${input.exportId} (in-memory dev queue — no worker)`);
  }
}
