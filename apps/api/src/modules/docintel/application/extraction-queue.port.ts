/** Extraction-job queue abstraction. Prod = BullMQ → capability-limited worker (cannot post). */
export interface ExtractionQueue {
  enqueue(input: { documentId: string; tenantId: string; companyId: string }): Promise<void>;
}
export const EXTRACTION_QUEUE = Symbol('DocIntel.ExtractionQueue');
