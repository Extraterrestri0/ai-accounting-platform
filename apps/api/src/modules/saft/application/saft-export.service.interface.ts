import type { ApplicationService } from '../../../shared-kernel';
import type { SaftDataset, SaftExportRecord } from '../domain/models';

/** Short-lived signed download for a generated SAF-T artifact. */
export interface SaftDownloadInfo { url: string; filename: string; expiresInSeconds: number; }

export interface ISaftExportService extends ApplicationService {
  /** v1 SYNCHRONOUS: build → validate → persist (status generated|failed) → audit. Returns the record. */
  generateExport(year: number, month: number): Promise<SaftExportRecord>;
  /**
   * v2 ASYNC: create a 'queued' export + audit 'requested' + enqueue a background job, returning
   * the queued record. Duplicate-submit safe: an already queued/processing export for the same
   * period is returned instead of creating a new one.
   */
  requestExport(year: number, month: number): Promise<SaftExportRecord>;
  /**
   * Worker entrypoint. Idempotent state machine: claims queued|failed → processing, builds +
   * validates + persists the dataset → completed; on error → failed (+ rethrow for retry/backoff).
   * A duplicate delivery after completion is a no-op.
   */
  processExport(exportId: string): Promise<void>;
  getExport(id: string): Promise<SaftExportRecord | null>;
  listExports(page?: number, pageSize?: number): Promise<SaftExportRecord[]>;
  /** Issue a short-lived signed URL for the export's XML artifact (audited). Null if none exists. */
  getDownloadUrl(exportId: string): Promise<SaftDownloadInfo | null>;
  /** The stored normalized dataset JSON for an export (for preview / download). */
  getExportDataset(id: string): Promise<SaftDataset | null>;
}
export const SAFT_EXPORT_SERVICE = Symbol('Saft.ExportService');
