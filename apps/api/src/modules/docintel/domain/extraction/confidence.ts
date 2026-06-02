import { isValidEik } from '../../../masterdata';
import type { ExtractedField, FieldKey } from './models';

function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const re = s.slice(4) + s.slice(0, 4);
  const num = [...re].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join('');
  let rem = 0; for (const ch of num) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}
const round = (n: number): number => Math.round(n * 1000) / 1000;

/** Apply deterministic validation (Invariant 6): validators override OCR confidence. */
export function applyValidation(fields: ExtractedField[]): ExtractedField[] {
  return fields.map((x) => {
    let { validationStatus, confidence } = x;
    const v = x.valueText;
    if (x.key === 'supplier_eik' && v) { const ok = isValidEik(v); validationStatus = ok ? 'valid' : 'invalid'; confidence = ok ? Math.max(confidence, 0.95) : Math.min(confidence, 0.4); }
    if (x.key === 'supplier_vat' && v) { const ok = /^BG\d{9,10}$/.test(v) ? isValidEik(v.slice(2)) : /^[A-Z]{2}\d{8,12}$/.test(v); validationStatus = ok ? 'valid' : 'warning'; if (!ok) confidence = Math.min(confidence, 0.5); }
    if (x.key === 'iban' && v) { const ok = ibanValid(v); validationStatus = ok ? 'valid' : 'invalid'; confidence = ok ? Math.max(confidence, 0.95) : Math.min(confidence, 0.4); }
    return { ...x, validationStatus, confidence: round(confidence) };
  });
}

const REQUIRED: FieldKey[] = ['invoice_number', 'total_amount', 'supplier_name'];
export function overallConfidence(fields: ExtractedField[]): number {
  const present = fields.filter((f) => REQUIRED.includes(f.key));
  if (!present.length) return 0;
  const min = Math.min(...present.map((f) => f.confidence));
  const avg = present.reduce((s, f) => s + f.confidence, 0) / present.length;
  return round(min * 0.6 + avg * 0.4);
}
export function reviewFlags(fields: ExtractedField[]): { lowConfidenceFields: FieldKey[]; failedValidations: FieldKey[]; missingRequired: FieldKey[] } {
  const LOW = 0.85;
  return {
    lowConfidenceFields: fields.filter((f) => f.confidence < LOW).map((f) => f.key),
    failedValidations: fields.filter((f) => f.validationStatus === 'invalid').map((f) => f.key),
    missingRequired: REQUIRED.filter((k) => !fields.some((f) => f.key === k)),
  };
}
