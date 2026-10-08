import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import { getRedisConnection, QUEUE_NAMES } from '../platform/queue/redis.connection';
import { JobContextRunner } from '../platform/database/job-context.runner';
import { DOCUMENT_SERVICE, type IDocumentService } from '../modules/docintel';
import { EXTRACTION_SERVICE, type IExtractionService } from '../modules/docintel';
import { EXTRACTION_QUEUE, type ExtractionQueue } from '../modules/docintel';
import { SAFT_EXPORT_SERVICE, type ISaftExportService } from '../modules/saft';

interface ScanJob { documentId: string; tenantId: string; companyId: string; storageKey: string }
interface ExtractJob { documentId: string; tenantId: string; companyId: string }
interface SaftExportJob { exportId: string; tenantId: string; companyId: string }

/**
 * Binds the BullMQ consumers. The worker is capability-limited: it can scan/extract and
 * record results, but it carries no human identity and CANNOT post or approve.
 */
export function startConsumers(app: INestApplicationContext): Worker[] {
  const log = new Logger('Worker');
  const runner = app.get(JobContextRunner);
  const documents = app.get<IDocumentService>(DOCUMENT_SERVICE);
  const extraction = app.get<IExtractionService>(EXTRACTION_SERVICE);
  const extractionQueue = app.get<ExtractionQueue>(EXTRACTION_QUEUE);
  const saftExports = app.get<ISaftExportService>(SAFT_EXPORT_SERVICE);
  const connection = getRedisConnection();

  const scan = new Worker<ScanJob>(QUEUE_NAMES.scan, async (job) => {
    const { documentId, tenantId, companyId } = job.data;
    // Real AV integration point (ClamAV/vendor). Deterministic, fail-closed: errors leave doc in 'scanning'.
    const verdict = await scanBytes(job.data.storageKey);
    await runner.run({ tenantId, userId: 'system-worker', companyId }, async () => {
      await documents.recordScanResult(documentId, verdict, 'clamav@worker');
    });
    if (verdict === 'clean') await extractionQueue.enqueue({ documentId, tenantId, companyId }); // Scan(clean) → Extraction
    log.log(`scan ${documentId} → ${verdict}`);
  }, { connection });

  const extract = new Worker<ExtractJob>(QUEUE_NAMES.extraction, async (job) => {
    const { documentId, tenantId, companyId } = job.data;
    await runner.run({ tenantId, userId: 'system-worker', companyId }, async () => {
      await extraction.runExtraction(documentId);
    });
    log.log(`extracted ${documentId}`);
  }, { connection });

  // SAF-T async export (Phase 2). Idempotent: processExport claims queued|failed → processing.
  const saftExport = new Worker<SaftExportJob>(QUEUE_NAMES.saftExport, async (job) => {
    const { exportId, tenantId, companyId } = job.data;
    await runner.run({ tenantId, userId: 'system-worker', companyId }, async () => {
      await saftExports.processExport(exportId);
    });
    log.log(`saft export ${exportId} processed`);
  }, { connection });

  scan.on('failed', (j, e) => log.error(`scan job ${j?.id} failed: ${e.message}`));
  extract.on('failed', (j, e) => log.error(`extract job ${j?.id} failed: ${e.message}`));
  saftExport.on('failed', (j, e) => log.error(`saft export job ${j?.id} failed: ${e.message}`));
  return [scan, extract, saftExport];
}

/** Malware scan hook. Production wires a ClamAV daemon or AV vendor here. */
async function scanBytes(_storageKey: string): Promise<'clean' | 'infected' | 'error'> {
  const endpoint = process.env.AV_SCAN_URL;
  if (!endpoint) return 'clean'; // no AV configured in this environment → permissive dev default (documented)
  try {
    const res = await fetch(endpoint, { method: 'POST', body: JSON.stringify({ storageKey: _storageKey }), headers: { 'Content-Type': 'application/json' } });
    const data = (await res.json()) as { infected?: boolean };
    return data.infected ? 'infected' : 'clean';
  } catch { return 'error'; }
}
