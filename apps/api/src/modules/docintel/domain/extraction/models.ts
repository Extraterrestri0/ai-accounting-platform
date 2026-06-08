/** Extraction domain models. */
export type RunMethod = 'ocr' | 'xml' | 'hybrid';
export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type DocType = 'invoice' | 'credit_note' | 'receipt' | 'other';
export type FieldSource = 'ocr' | 'xml' | 'derived';
export type ValidationStatus = 'valid' | 'invalid' | 'warning' | 'unchecked';

export const FIELD_KEYS = [
  'supplier_name', 'supplier_vat', 'supplier_eik', 'supplier_city',
  'supplier_address', 'supplier_country',
  'customer_name', 'customer_eik', 'customer_vat',
  'invoice_number', 'document_number', 'document_type',
  'invoice_date', 'due_date', 'currency',
  'net_amount', 'vat_amount', 'total_amount', 'vat_rate', 'vat_code',
  'iban', 'bank_name', 'bank_bic', 'payment_method', 'payment_reference',
  'description', 'notes', 'line_items',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export interface ExtractedField {
  key: FieldKey; valueText?: string; valueNormalized?: string;
  confidence: number; source: FieldSource; validationStatus: ValidationStatus;
}

/**
 * Extraction diagnostics (0037) — recorded per run so a missing/derived/rejected
 * field is EXPLAINABLE in the review screen and the logs. Never used to drop a
 * value: rejected candidates are losers of a same-key contest, not discarded data.
 */
export interface RejectedCandidate {
  key: FieldKey; value: string; confidence: number; source: FieldSource; reason: string;
}
export interface FieldProvenance {
  key: FieldKey; layer: string; confidence: number;
  alternatives?: Array<{ value: string; confidence: number; source: FieldSource }>;
}
export interface ExtractionDiagnostics {
  provider?: string; model?: string; engine: string; method: RunMethod;
  layersRun: string[];      // e.g. ['vendor','text','heuristics','validation']
  found: FieldKey[];        // keys with an accepted value
  derived: FieldKey[];      // keys produced by the heuristic accounting layer
  rejected: RejectedCandidate[];
  missingRequired: FieldKey[];
  provenance: FieldProvenance[];
}
export interface ExtractionResult {
  method: RunMethod; engine: string; docType: DocType;
  fields: ExtractedField[]; overallConfidence: number;
}
export interface ExtractionRun { id: string; documentId: string; method: RunMethod; engine: string; status: RunStatus; overallConfidence?: number; }
export interface DocumentExtraction { id: string; documentId: string; runId: string; docType: DocType; overallConfidence: number; status: 'extracted' | 'superseded'; fields: ExtractedField[]; diagnostics?: ExtractionDiagnostics; }

/** Review-ready package consumed by the Rules Engine (009) and Review Queue (010). */
export interface ReviewPackage {
  documentId: string; extractionId: string; docType: DocType; overallConfidence: number;
  fields: ExtractedField[];
  flags: { lowConfidenceFields: FieldKey[]; failedValidations: FieldKey[]; missingRequired: FieldKey[] };
  diagnostics?: ExtractionDiagnostics;
}
