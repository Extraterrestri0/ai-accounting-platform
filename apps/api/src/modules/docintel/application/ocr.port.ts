/** OCR provider abstraction. Prod = EU-resident, zero-retention OCR vendor (Invariant 7). */
export interface OcrResult { text: string; pageCount: number; engine: string; }
export interface OcrProvider {
  recognize(bytes: Buffer, mimeType: string): Promise<OcrResult>;
}
export const OCR_PROVIDER = Symbol('DocIntel.OcrProvider');
