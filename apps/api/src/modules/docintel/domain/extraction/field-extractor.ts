import type { ExtractedField, FieldKey } from './models';

const norm = (s: string): string => s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');

/** Deterministic text → fields (regex/keyword). Used for OCR output and as a fallback. */
export function extractFromText(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  const push = (key: FieldKey, valueText: string, confidence: number): void => {
    f.push({ key, valueText, confidence, source: 'ocr', validationStatus: 'unchecked' });
  };
  let m: RegExpMatchArray | null;
  if ((m = text.match(/(?:invoice\s*(?:no|number|#)|фактура\s*№?)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i))) push('invoice_number', m[1], 0.97);
  if ((m = text.match(/(?:invoice\s*date|дата)\s*[:#]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/i))) push('invoice_date', m[1], 0.95);
  if ((m = text.match(/(?:due\s*date|падеж)\s*[:#]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/i))) push('due_date', m[1], 0.93);
  if ((m = text.match(/\b(EUR|BGN|USD|GBP|€|лв)\b/i))) push('currency', m[1], 0.9);
  if ((m = text.match(/(?:net|данъчна основа|subtotal)\s*[:#]?\s*([\d.,]+)/i))) push('net_amount', norm(m[1]), 0.9);
  if ((m = text.match(/(?:vat|ддс)\s*(?:\(\d+%\))?\s*[:#]?\s*([\d.,]+)/i))) push('vat_amount', norm(m[1]), 0.92);
  if ((m = text.match(/(?:total|общо|сума за плащане)\s*[:#]?\s*([\d.,]+)/i))) push('total_amount', norm(m[1]), 0.94);
  if ((m = text.match(/\b(BG\d{9,10}|[A-Z]{2}\d{8,12})\b/))) push('supplier_vat', m[1], 0.9);
  if ((m = text.match(/(?:ЕИК|EIK|БУЛСТАТ)\s*[:#]?\s*(\d{9,13})/i))) push('supplier_eik', m[1], 0.9);
  if ((m = text.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/))) push('iban', m[1], 0.88);
  if ((m = text.match(/(?:supplier|доставчик|from)\s*[:#]?\s*([A-Za-z\u0400-\u04FF][\w .,&\u0400-\u04FF]{2,40}?(?:OOD|EOOD|AD|ООД|ЕООД|АД|GmbH|Ltd))/i))) push('supplier_name', m[1].trim(), 0.84);
  if ((m = text.match(/(?:bill\s*to|customer|получател)\s*[:#]?\s*([A-Za-z\u0400-\u04FF][\w .,&\u0400-\u04FF]{2,40})/i))) push('customer_name', m[1].trim(), 0.8);
  if ((m = text.match(/(?:reference|основание|ref)\s*[:#]?\s*([A-Z0-9\-/]{3,})/i))) push('payment_reference', m[1], 0.8);
  return f;
}
