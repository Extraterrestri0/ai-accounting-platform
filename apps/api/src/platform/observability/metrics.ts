import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Process-wide Prometheus registry + SAF-T export pipeline metrics. Pull-based: the
 * /metrics endpoint serializes this registry on scrape. Labels are kept low-cardinality
 * (never per-tenant / per-export) to avoid cardinality blow-up, and no metric value or
 * label ever carries PII.
 */
export const registry = new Registry();
collectDefaultMetrics({ register: registry }); // node process/runtime metrics

const DURATION_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30];

export const saftExportRequested = new Counter({
  name: 'saft_export_requested_total', help: 'SAF-T exports requested (async path).', registers: [registry],
});
export const saftExportCompleted = new Counter({
  name: 'saft_export_completed_total', help: 'SAF-T exports completed.', labelNames: ['xsd_valid'], registers: [registry],
});
export const saftExportFailed = new Counter({
  name: 'saft_export_failed_total', help: 'SAF-T exports failed during processing.', registers: [registry],
});

export const saftXmlRenderDuration = new Histogram({
  name: 'saft_xml_render_duration_seconds', help: 'Time to render SAF-T XML from the dataset.', buckets: DURATION_BUCKETS, registers: [registry],
});
export const saftValidationDuration = new Histogram({
  name: 'saft_validation_duration_seconds', help: 'Time to XSD-validate the rendered XML.', buckets: DURATION_BUCKETS, registers: [registry],
});
export const saftStorageWriteDuration = new Histogram({
  name: 'saft_storage_write_duration_seconds', help: 'Time to write the XML artifact to storage.', buckets: DURATION_BUCKETS, registers: [registry],
});

// Scrape-time gauges (refreshed from the queue before serialization).
export const saftQueueDepth = new Gauge({ name: 'saft_queue_depth', help: 'Waiting + delayed SAF-T export jobs.', registers: [registry] });
export const saftFailedJobs = new Gauge({ name: 'saft_failed_jobs', help: 'Failed (DLQ) SAF-T export jobs in the queue.', registers: [registry] });
export const saftStuckQueued = new Gauge({ name: 'saft_stuck_queued_exports', help: 'Waiting jobs older than the stuck threshold.', registers: [registry] });
export const saftStuckProcessing = new Gauge({ name: 'saft_stuck_processing_exports', help: 'Active jobs older than the stuck threshold.', registers: [registry] });
export const saftWorkersConnected = new Gauge({ name: 'saft_workers_connected', help: 'Connected SAF-T queue workers.', registers: [registry] });
export const saftQueueAvailable = new Gauge({ name: 'saft_queue_available', help: '1 if the queue/Redis is reachable, else 0.', registers: [registry] });

export interface SaftQueueStats {
  waiting: number; active: number; delayed: number; failed: number; completed: number;
  workers: number; stuckQueued: number; stuckProcessing: number;
}

/** Refresh the queue gauges from a stats snapshot (null ⇒ queue unavailable: zero everything). */
export function refreshQueueGauges(stats: SaftQueueStats | null): void {
  if (!stats) {
    saftQueueAvailable.set(0);
    for (const g of [saftQueueDepth, saftFailedJobs, saftStuckQueued, saftStuckProcessing, saftWorkersConnected]) g.set(0);
    return;
  }
  saftQueueAvailable.set(1);
  saftQueueDepth.set(stats.waiting + stats.delayed);
  saftFailedJobs.set(stats.failed);
  saftStuckQueued.set(stats.stuckQueued);
  saftStuckProcessing.set(stats.stuckProcessing);
  saftWorkersConnected.set(stats.workers);
}
