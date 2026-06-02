/** Malware-scan pipeline abstraction. Prod = BullMQ job → Python ClamAV/vendor worker. */
export interface MalwareScanQueue {
  enqueue(input: { documentId: string; tenantId: string; companyId: string; storageKey: string }): Promise<void>;
}
export const MALWARE_SCAN_QUEUE = Symbol('DocIntel.MalwareScanQueue');
