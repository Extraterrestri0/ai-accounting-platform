import type { ExtractedField, FieldKey } from './models';

/** Structural shape of a vendor-provided structured field (mirrors application OcrField). */
export interface VendorField { key: FieldKey; value: string; confidence: number; }

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Convert raw vendor (Document-AI) fields into domain ExtractedField[] (unvalidated). */
export function fromVendorFields(fields: VendorField[]): ExtractedField[] {
  return fields
    .filter((f) => f.value != null && String(f.value).trim() !== '')
    .map((f): ExtractedField => ({
      key: f.key,
      valueText: String(f.value).trim(),
      confidence: clamp01(f.confidence),
      source: 'ocr',
      validationStatus: 'unchecked',
    }));
}

/**
 * Merge structured (vendor) fields with text/regex fields.
 * Vendor fields take precedence per key; the regex pass only BACKFILLS keys the
 * vendor did not return. Deterministic validation (confidence.ts) runs afterwards
 * and still overrides confidence — vendor output never outranks a deterministic check.
 */
export function mergeFields(primary: ExtractedField[], backfill: ExtractedField[]): { fields: ExtractedField[]; backfilled: number } {
  const byKey = new Map<FieldKey, ExtractedField>(primary.map((f) => [f.key, f]));
  let backfilled = 0;
  for (const f of backfill) {
    if (!byKey.has(f.key) && f.valueText) { byKey.set(f.key, f); backfilled++; }
  }
  return { fields: [...byKey.values()], backfilled };
}
