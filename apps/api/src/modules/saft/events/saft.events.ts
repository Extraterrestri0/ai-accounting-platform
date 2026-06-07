// Domain event / audit-action names PUBLISHED by the SAF-T context (Task: SAF-T v1).
export const SaftEvents = {
  ExportRequested: 'saft.export_requested',
  ExportGenerated: 'saft.export_generated',
  ExportFailed: 'saft.export_failed',
  ExportDownloaded: 'saft.export_downloaded',
  DatasetValidated: 'saft.dataset_validated',
} as const;

export type SaftEventType = (typeof SaftEvents)[keyof typeof SaftEvents];
