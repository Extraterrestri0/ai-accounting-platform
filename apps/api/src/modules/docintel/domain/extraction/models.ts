/** Extraction domain models. */
export type RunMethod = 'ocr' | 'xml' | 'hybrid';
export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type DocType = 'invoice' | 'credit_note' | 'receipt' | 'other';
export type FieldSource = 'ocr' | 'xml' | 'derived';
export type ValidationStatus = 'valid' | 'invalid' | 'warning' | 'unchecked';

export const FIELD_KEYS = [
  'supplier_name', 'supplier_vat', 'supplier_eik', 'customer_name',
  'invoice_number', 'invoice_date', 'due_date', 'currency',
  'net_amount', 'vat_amount', 'total_amount', 'iban', 'payment_reference',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export interface ExtractedField {
  key: FieldKey; valueText?: string; valueNormalized?: string;
  confidence: number; source: FieldSource; validationStatus: ValidationStatus;
}
export interface ExtractionResult {
  method: RunMethod; engine: string; docType: DocType;
  fields: ExtractedField[]; overallConfidence: number;
}
export interface ExtractionRun { id: string; documentId: string; method: RunMethod; engine: string; status: RunStatus; overallConfidence?: number; }
export interface DocumentExtraction { id: string; documentId: string; runId: string; docType: DocType; overallConfidence: number; status: 'extracted' | 'superseded'; fields: ExtractedField[]; }

/** Review-ready package consumed by the Rules Engine (009) and Review Queue (010). */
export interface ReviewPackage {
  documentId: string; extractionId: string; docType: DocType; overallConfidence: number;
  fields: ExtractedField[];
  flags: { lowConfidenceFields: FieldKey[]; failedValidations: FieldKey[]; missingRequired: FieldKey[] };
}
