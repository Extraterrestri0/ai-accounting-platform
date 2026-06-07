import type { ApplicationService } from '../../../shared-kernel';
import type { SaftDataset, SaftExportRecord } from '../domain/models';

export interface ISaftExportService extends ApplicationService {
  /** Build → validate → persist (status generated|failed) → audit. Returns the record. */
  generateExport(year: number, month: number): Promise<SaftExportRecord>;
  getExport(id: string): Promise<SaftExportRecord | null>;
  listExports(page?: number, pageSize?: number): Promise<SaftExportRecord[]>;
  /** The stored normalized dataset JSON for an export (for preview / download). */
  getExportDataset(id: string): Promise<SaftDataset | null>;
}
export const SAFT_EXPORT_SERVICE = Symbol('Saft.ExportService');
