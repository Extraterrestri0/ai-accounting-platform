import { buildSaftLogRecord, safeErrorName } from '../../src/platform/observability/structured-log';
import {
  registry, saftExportRequested, saftExportCompleted, saftExportFailed,
  saftXmlRenderDuration, refreshQueueGauges,
} from '../../src/platform/observability/metrics';

describe('structured-log — PII-free by whitelist (§11)', () => {
  it('keeps only whitelisted operational fields and drops anything PII-bearing', () => {
    const rec = buildSaftLogRecord({
      event: 'saft.completed', exportId: 'e1', tenantId: 't1', companyId: 'c1', year: 2026, month: 5,
      status: 'completed', xsdValid: null, glEntries: 3, sizeBytes: 1200, durationMs: 42,
      // none of these may ever appear in logs:
      companyName: 'Acme OOD', customerName: 'Иван', amount: '1234.56', vatNumber: 'BG123',
      taxId: 'BG999', storageKey: 'saft/c1/2026-05/e1/a.xml', url: 'https://signed', xml: '<AuditFile/>',
    });
    expect(rec).toEqual({
      event: 'saft.completed', exportId: 'e1', tenantId: 't1', companyId: 'c1', year: 2026, month: 5,
      status: 'completed', xsdValid: null, glEntries: 3, sizeBytes: 1200, durationMs: 42,
    });
    const keys = Object.keys(rec);
    for (const banned of ['companyName', 'customerName', 'amount', 'vatNumber', 'taxId', 'storageKey', 'url', 'xml']) {
      expect(keys).not.toContain(banned);
    }
  });

  it('omits undefined fields', () => {
    expect(buildSaftLogRecord({ event: 'saft.requested', exportId: 'e1' })).toEqual({ event: 'saft.requested', exportId: 'e1' });
  });

  it('safeErrorName reduces errors to their class name (never the message)', () => {
    expect(safeErrorName(new TypeError('contains BG123456789 secret'))).toBe('TypeError');
    expect(safeErrorName('boom')).toBe('Error');
  });
});

describe('prom-client metrics registry', () => {
  it('registers the SAF-T pipeline metrics', async () => {
    const text = await registry.metrics();
    for (const name of [
      'saft_export_requested_total', 'saft_export_completed_total', 'saft_export_failed_total',
      'saft_xml_render_duration_seconds', 'saft_validation_duration_seconds', 'saft_storage_write_duration_seconds',
      'saft_queue_depth', 'saft_failed_jobs', 'saft_stuck_queued_exports', 'saft_stuck_processing_exports',
      'saft_workers_connected', 'saft_queue_available',
    ]) {
      expect(text).toContain(name);
    }
  });

  it('counters increment and histograms observe', async () => {
    saftExportRequested.inc();
    saftExportCompleted.inc({ xsd_valid: 'null' });
    saftExportFailed.inc();
    saftXmlRenderDuration.observe(0.01);
    const text = await registry.metrics();
    expect(text).toMatch(/saft_export_requested_total \d+/);
    expect(text).toContain('saft_export_completed_total{xsd_valid="null"}');
    expect(text).toMatch(/saft_xml_render_duration_seconds_count \d+/);
  });

  it('refreshQueueGauges(null) marks the queue unavailable and zeroes the gauges', async () => {
    refreshQueueGauges(null);
    const text = await registry.metrics();
    expect(text).toContain('saft_queue_available 0');
    expect(text).toContain('saft_queue_depth 0');
  });

  it('refreshQueueGauges(stats) reflects a snapshot', async () => {
    refreshQueueGauges({ waiting: 2, active: 1, delayed: 3, failed: 4, completed: 9, workers: 1, stuckQueued: 1, stuckProcessing: 0 });
    const text = await registry.metrics();
    expect(text).toContain('saft_queue_available 1');
    expect(text).toContain('saft_queue_depth 5'); // waiting + delayed
    expect(text).toContain('saft_failed_jobs 4');
    expect(text).toContain('saft_stuck_queued_exports 1');
    expect(text).toContain('saft_workers_connected 1');
  });
});
