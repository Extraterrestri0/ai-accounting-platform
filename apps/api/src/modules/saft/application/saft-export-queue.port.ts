/**
 * SAF-T export-job queue abstraction. Prod = BullMQ → the capability-limited worker
 * (which builds + validates + — in later phases — renders/validates/stores the file).
 * The worker carries no human identity and cannot post or file.
 */
export interface SaftExportQueue {
  enqueue(input: { exportId: string; tenantId: string; companyId: string }): Promise<void>;
}
export const SAFT_EXPORT_QUEUE = Symbol('Saft.ExportQueue');
