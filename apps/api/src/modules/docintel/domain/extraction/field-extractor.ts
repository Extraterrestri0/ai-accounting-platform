import type { ExtractedField, FieldKey } from './models';

const norm = (s: string): string => s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Deterministic text → header fields (regex/keyword), Bulgarian-first.
 * Label-driven patterns (Доставчик:/Получател:/ЕИК:/Банка:/BIC:/IBAN:…) with generic
 * fallbacks. Used for OCR output and the dev OCR sample. Line-item tables are not
 * modelled as structured fields here (header fields only) — see TASK_008.
 */
export function extractFromText(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  const push = (key: FieldKey, valueText: string, confidence: number): void => {
    if (!valueText) return;
    f.push({ key, valueText, confidence, source: 'ocr', validationStatus: 'unchecked' });
  };
  const m = (re: RegExp): string | undefined => text.match(re)?.[1];

  // --- invoice header ---
  push('invoice_number', m(/(?:invoice\s*(?:no|number|#)|фактура\s*№?|номер)\s*[:#№]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i) ?? '', 0.95);
  push('invoice_date', m(/(?:invoice\s*date|дата(?:\s*на\s*издаване)?)\s*[:#]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/i) ?? '', 0.93);
  push('due_date', m(/(?:due\s*date|падеж|срок\s*за\s*плащане)\s*[:#]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/i) ?? '', 0.9);
  push('currency', (m(/(?:валута|currency)\s*[:#]?\s*(BGN|EUR|USD|GBP)/i) ?? m(/\b(BGN|EUR|USD|GBP)\b/) ?? '').toUpperCase(), 0.9);

  // --- supplier (доставчик) ---
  const supplier = m(/(?:доставчик|продавач|supplier|from)\s*[:#]?\s*([^\n]{2,60}?)\s*(?:\n|ЕИК|EIK|ДДС|VAT|Град|$)/i);
  push('supplier_name', supplier ? clean(supplier) : (m(/([A-Za-zЀ-ӿ][\w .,&Ѐ-ӿ]{2,40}?(?:OOD|EOOD|AD|ООД|ЕООД|АД|GmbH|Ltd))/i) ?? ''), 0.86);
  push('supplier_city', clean(m(/(?:град|гр\.?|city)\s*[:#]?\s*([А-Яа-яA-Za-z][А-Яа-яA-Za-z\- ]{1,30})/i) ?? ''), 0.8);
  push('supplier_eik', m(/(?:ЕИК|EIK|БУЛСТАТ)\s*[:#]?\s*(\d{9,13})/i) ?? '', 0.9);
  push('supplier_vat', m(/(?:ДДС\s*№|VAT)\s*[:#]?\s*(BG\d{9,10}|[A-Z]{2}\d{8,12})/i) ?? m(/\b(BG\d{9,10})\b/) ?? '', 0.9);

  // --- customer (получател) — distinct labels so it doesn't collide with the supplier ---
  push('customer_name', clean(m(/(?:получател|купувач|клиент|bill\s*to|customer)\s*[:#]?\s*([^\n]{2,60}?)\s*(?:\n|ЕИК|EIK|ДДС|VAT|$)/i) ?? ''), 0.82);
  push('customer_eik', m(/(?:ЕИК|EIK|БУЛСТАТ)\s*(?:на\s*получателя)\s*[:#]?\s*(\d{9,13})/i) ?? '', 0.8);
  push('customer_vat', m(/(?:ДДС\s*№?)\s*(?:на\s*получателя)\s*[:#]?\s*(BG\d{9,10})/i) ?? '', 0.8);

  // --- amounts ---
  push('net_amount', norm(m(/(?:данъчна\s*основа|облагаема\s*основа|net|subtotal)\s*[:#]?\s*([\d., ]+\d)/i) ?? ''), 0.9);
  push('vat_amount', norm(m(/(?:ддс|vat)\s*(?:\d{1,2}\s*%|\(\d+%\))?\s*[:#]?\s*([\d., ]+\d)/i) ?? ''), 0.91);
  push('total_amount', norm(m(/(?:общо\s*(?:за\s*плащане)?|сума\s*за\s*плащане|total|amount\s*due)\s*[:#]?\s*([\d., ]+\d)/i) ?? ''), 0.93);
  push('vat_rate', m(/ддс\s*(\d{1,2})\s*%|(\d{1,2})\s*%\s*ддс/i) ?? '', 0.88);

  // --- payment ---
  push('iban', m(/(?:IBAN)\s*[:#]?\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})/i) ?? m(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/) ?? '', 0.9);
  push('bank_bic', m(/(?:BIC|SWIFT|БИК)\s*[:#]?\s*([A-Z]{6}[A-Z0-9]{2,5})/i) ?? '', 0.85);
  push('bank_name', clean(m(/(?:банка|bank)\s*[:#]?\s*([^\n]{2,40})/i) ?? ''), 0.78);
  push('payment_method', clean(m(/(?:начин\s*на\s*плащане|payment\s*method)\s*[:#]?\s*([^\n]{2,30})/i) ?? ''), 0.8);
  push('payment_reference', m(/(?:reference|основание|ref)\s*[:#]?\s*([A-Z0-9\-/]{3,})/i) ?? '', 0.78);

  return f;
}
