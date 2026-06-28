import type { FieldKey } from '../domain/extraction/models';

/**
 * OCR / Document-AI provider abstraction.
 *
 * Two tiers behind one port (Invariant 7: EU-resident, zero-retention):
 *   - Pure OCR providers return TEXT only (pdfjs born-digital, generic OCR, dev stub).
 *     The Bulgarian regex field-extractor then derives the fields.
 *   - Document-AI providers (Azure Document Intelligence, generic structured HTTP)
 *     ADDITIONALLY return STRUCTURED fields with per-field vendor confidence.
 *
 * `fields` is OPTIONAL so existing text-only providers keep working unchanged.
 */
export interface OcrField {
  key: FieldKey;
  value: string;
  confidence: number; // 0..1, vendor-reported
}

export interface OcrResult {
  text: string;
  pageCount: number;
  engine: string;        // human id, e.g. 'pdf-text@embedded', 'azure-docintel@prebuilt-invoice'
  provider?: string;     // 'pdfjs' | 'azure' | 'http' | 'dev' | 'stub'
  model?: string;        // model/version, e.g. 'prebuilt-invoice/2023-07-31'
  fields?: OcrField[];   // structured fields (Document-AI providers only)
}

export interface OcrProvider {
  recognize(bytes: Buffer, mimeType: string): Promise<OcrResult>;
}

export const OCR_PROVIDER = Symbol('DocIntel.OcrProvider');
