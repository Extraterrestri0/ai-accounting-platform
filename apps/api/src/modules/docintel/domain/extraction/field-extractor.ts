import type { ExtractedField, FieldKey } from './models';

const norm = (s: string): string => s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

// Bulgarian month names → month number (covers full + common short forms).
const BG_MONTHS: Record<string, string> = {
  'януари': '01', 'февруари': '02', 'март': '03', 'април': '04', 'май': '05', 'юни': '06',
  'юли': '07', 'август': '08', 'септември': '09', 'октомври': '10', 'ноември': '11', 'декември': '12',
};
const pad = (n: string): string => (n.length === 1 ? '0' + n : n);

/** Normalize a date token to canonical ISO yyyy-mm-dd; returns '' if unrecognized. */
function isoDate(raw: string): string {
  const s = raw.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;       // yyyy-mm-dd | yyyy/mm/dd
  if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/))) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;       // dd.mm.yyyy | dd/mm/yyyy
  if ((m = s.match(/^(\d{1,2})\s+([А-Яа-яЀ-ӿ]+)\s+(\d{4})$/))) {                                                // D <bg-month> YYYY
    const mm = BG_MONTHS[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${pad(m[1])}`;
  }
  return '';
}

/**
 * Deterministic text → header fields (regex/keyword), Bulgarian-first. Label-driven
 * patterns with generic fallbacks, tolerant of BOTH pdf.js born-digital text (items
 * space-joined, ~one newline per page) and OCR/structured line output. May emit MORE
 * than one candidate for a key (e.g. amounts) — the pipeline's selectBest() keeps the
 * highest-confidence one and records the alternatives as diagnostics (never silently
 * dropped). Line-item rows are summarized (count) rather than fully modelled.
 */
export function extractFromText(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  const push = (key: FieldKey, valueText: string, confidence: number, valueNormalized?: string): void => {
    if (!valueText) return;
    f.push({ key, valueText, valueNormalized, confidence, source: 'ocr', validationStatus: 'unchecked' });
  };
  const m = (re: RegExp): string | undefined => text.match(re)?.[1];
  const pushDate = (key: FieldKey, raw: string | undefined, confidence: number): void => {
    if (!raw) return;
    const iso = isoDate(raw);
    if (iso) push(key, iso, confidence);
    else push(key, clean(raw), confidence - 0.1); // keep the raw value rather than drop it
  };
  const dateTok = '(\\d{4}[-./]\\d{1,2}[-./]\\d{1,2}|\\d{1,2}[-./]\\d{1,2}[-./]\\d{4}|\\d{1,2}\\s+[А-Яа-яЀ-ӿ]+\\s+\\d{4})';

  // --- document identity ---
  // Allow Cyrillic/Latin prefixes (e.g. "ФБ-2026-0099") but REQUIRE a digit so the
  // capture can't latch onto a Cyrillic label word ("Номер", "Фактура", "Дата").
  const idTok = '([A-Za-z0-9Ѐ-ӿ][A-Za-z0-9Ѐ-ӿ\\-/]*\\d[A-Za-z0-9Ѐ-ӿ\\-/]*)';
  // Tolerate a bilingual label ("Фактура / Invoice КИ-2026-0001") — the number may follow a
  // slash-separated translation of the label rather than a colon/№. Still requires a digit.
  const numLabel = '(?:invoice|фактура|ф-ра|номер|number)\\s*(?:№|no\\.?|number|#)?\\s*(?:\\/\\s*[A-Za-zЀ-ӿ]+)?\\s*[:#№]?\\s*';
  push('invoice_number', m(new RegExp(`${numLabel}${idTok}`, 'i')) ?? '', 0.95);
  push('document_number', m(new RegExp(`(?:документ\\s*№|document\\s*(?:no|number))\\s*(?:\\/\\s*[A-Za-zЀ-ӿ]+)?\\s*[:#№]?\\s*${idTok}`, 'i')) ?? '', 0.9);
  // explicit "Тип документ:" label, else infer from a header keyword.
  push('document_type', clean(m(/(?:тип\s*документ|document\s*type)\s*[:#]?\s*([^\n]{2,30}?)\s*(?:\n|$)/i)
    ?? (/\bкредитно\s*известие|credit\s*note\b/i.test(text) ? 'Кредитно известие'
      : /\bдебитно\s*известие|debit\s*note\b/i.test(text) ? 'Дебитно известие'
      : /\bпроформа|proforma\b/i.test(text) ? 'Проформа'
      : /\bфактура|invoice\b/i.test(text) ? 'Фактура' : '')), 0.8);

  // --- dates ---
  pushDate('invoice_date', m(new RegExp(`(?:invoice\\s*date|дата(?:\\s*на\\s*издаване)?)\\s*[:#]?\\s*${dateTok}`, 'i')), 0.93);
  // "Дата на дан.съб." / "Дата на данъчно събитие" — only when explicitly labeled.
  pushDate('tax_event_date', m(new RegExp(`(?:дата\\s*на\\s*дан(?:ъчно(?:то)?)?\\.?\\s*съб(?:итие)?\\.?|tax\\s*(?:point|event)\\s*date)\\s*[:#]?\\s*${dateTok}`, 'i')), 0.9);
  pushDate('due_date', m(new RegExp(`(?:due\\s*date|падеж|срок\\s*за\\s*плащане)\\s*[:#]?\\s*${dateTok}`, 'i')), 0.9);
  push('currency', (m(/(?:валута|currency)\s*[:#]?\s*(BGN|EUR|USD|GBP)/i) ?? m(/\b(BGN|EUR|USD|GBP)\b/) ?? '').toUpperCase(), 0.9);

  // --- supplier (доставчик) ---
  // ONLY take a labelled supplier. The previous bare "company-suffix anywhere" fallback
  // mis-attributed the CUSTOMER (e.g. "ACME GmbH" under Получател) as the supplier — a
  // wrong-attribution hallucination on real outgoing invoices. Unlabelled supplier names
  // are left to the Document-AI provider's VendorName (Azure) rather than guessed here.
  const supplier = m(/(?:доставчик|продавач|seller|supplier|from)\s*[:#]?\s*([^\n]{2,60}?)\s*(?:\n|ЕИК|EIK|ДДС|VAT|Адрес|Address|Град|City|Държава|Country|$)/i);
  push('supplier_name', supplier ? clean(supplier) : '', 0.86);
  push('supplier_city', clean(m(/(?:град|гр\.?|city)\s*[:#]?\s*([А-Яа-яA-Za-z][А-Яа-яA-Za-z\- ]{1,30})/i) ?? ''), 0.8);
  push('supplier_address', clean(m(/(?:адрес|address)\s*[:#]?\s*([^\n]{4,80}?)\s*(?:\n|държава|country|тел|phone|e-?mail|ЕИК|EIK|ДДС|VAT|IBAN|получател|customer|net|нето|данъчна|total|общо|$)/i) ?? ''), 0.76);
  push('supplier_country', clean(m(/(?:държава|страна|country)\s*[:#]?\s*([A-Za-zЀ-ӿ]{2,30})/i) ?? ''), 0.82);
  push('supplier_eik', m(/(?:ЕИК|EIK|БУЛСТАТ)\s*[:#]?\s*(\d{9,13})/i) ?? '', 0.9);
  push('supplier_vat', m(/(?:ДДС\s*№|VAT)\s*[:#]?\s*(BG\d{9,10}|[A-Z]{2}\d{8,12})/i) ?? m(/\b(BG\d{9,10})\b/) ?? '', 0.9);

  // --- customer (получател) — distinct labels so it doesn't collide with the supplier.
  // NEVER backfilled from supplier values (and vice versa) — wrong-party data is a
  // hallucination, so each side only matches its own explicit labels.
  push('customer_name', clean(m(/(?:получател|купувач|клиент|bill\s*to|customer)\s*[:#]?\s*([^\n]{2,60}?)\s*(?:\n|ЕИК|EIK|ДДС|VAT|Адрес|Address|$)/i) ?? ''), 0.82);
  push('customer_eik', m(/(?:ЕИК|EIK|БУЛСТАТ)\s*(?:на\s*(?:получателя|клиента))\s*[:#]?\s*(\d{9,13})/i) ?? '', 0.8);
  push('customer_vat', m(/(?:ДДС\s*№?)\s*(?:на\s*(?:получателя|клиента))\s*[:#]?\s*(BG\d{9,10})/i) ?? '', 0.8);
  push('customer_address', clean(m(/адрес\s*на\s*(?:получателя|клиента)\s*[:#]?\s*([^\n]{4,80}?)\s*(?:\n|държава|country|тел|ЕИК|ДДС|$)/i) ?? ''), 0.74);
  push('customer_country', clean(m(/държава\s*на\s*(?:получателя|клиента)\s*[:#]?\s*([A-Za-zЀ-ӿ]{2,30})/i) ?? ''), 0.78);

  // --- amounts (label-matched = high confidence; a currency-tagged token is kept as a low-conf alternative) ---
  push('net_amount', norm(m(/(?:данъчна\s*основа|облагаема\s*основа|net|subtotal)\s*[:#]?\s*([\d., ]+\d)/i) ?? ''), 0.9);
  push('vat_amount', norm(m(/(?:ддс|vat)\s*(?:\d{1,2}\s*%|\(\d+%\))?\s*[:#]?\s*([\d., ]+\d)/i) ?? ''), 0.91);
  push('total_amount', norm(m(/(?:общо\s*(?:за\s*плащане)?|сума\s*за\s*плащане|total|amount\s*due)\s*[:#]?\s*([\d., ]+\d)/i) ?? ''), 0.93);
  const taggedAmount = m(/(?:BGN|EUR|USD|GBP)\s*([\d., ]+\d)|([\d., ]+\d)\s*(?:BGN|EUR|USD|GBP)/i);
  if (taggedAmount) push('total_amount', norm(taggedAmount), 0.55); // alternative candidate for total
  push('vat_rate', m(/ддс\s*(\d{1,2})\s*%|(\d{1,2})\s*%\s*ддс|vat\s*\((\d{1,2})%\)/i) ?? '', 0.88);
  push('vat_code', m(/(?:ддс\s*код|данъчен\s*код|vat\s*code)\s*[:#]?\s*([A-Z0-9]{1,4})/i) ?? '', 0.8);
  // Reason for NOT charging VAT — explicit label, a legal basis (чл. … ЗДДС / Directive),
  // or the reverse-charge / intra-community phrases printed on the invoice.
  push('vat_exemption_reason', clean(
    m(/основание\s*за\s*неначисляване(?:\s*(?:на\s*)?ддс)?\s*[:#]?\s*([^\n]{3,120}?)\s*(?:\n|$)/i)
    ?? m(/(чл\.?\s*\d+[а-я]?(?:,?\s*ал\.?\s*\d+)?[^\n]{0,60}?(?:ЗДДС|Директива\s*[\d/]+|VAT\s*Directive))/i)
    ?? m(/(обратно\s*начисляване|reverse\s*charge|вътреобщностна\s*доставка|intra-?community\s*supply|освободена\s*доставка|exempt\s*supply)/i) ?? ''), 0.8);

  // --- payment ---
  push('iban', m(/(?:IBAN)\s*[:#]?\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})/i) ?? m(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/) ?? '', 0.9);
  push('bank_bic', m(/(?:BIC|SWIFT|БИК)\s*[:#]?\s*([A-Z]{6}[A-Z0-9]{2,5})/i) ?? '', 0.85);
  push('bank_name', clean(m(/(?:банка|bank)\s*[:#]?\s*([^\n]{2,40}?)\s*(?:\n|IBAN|BIC|SWIFT|БИК|$)/i) ?? ''), 0.8);
  push('payment_method', clean(m(/(?:начин\s*на\s*плащане|payment\s*method)\s*[:#]?\s*([^\n]{2,30}?)\s*(?:\n|банка|bank|IBAN|$)/i) ?? ''), 0.8);
  // reference may be Cyrillic (e.g. "Основание: Абонамент Q1 2026") — not just [A-Z0-9].
  // Lookahead excludes "Основание за неначисляване…" (that's the VAT exemption reason, not a payment ref).
  push('payment_reference', clean(m(/(?:reference|основание(?!\s*за\s*неначисл)|ref)\s*[:#]?\s*([A-Za-z0-9Ѐ-ӿ][A-Za-z0-9Ѐ-ӿ \-/]{2,60}?)\s*(?:\n|начин|payment|$)/i) ?? ''), 0.76);

  // --- order / contract / delivery references + vehicle (fuel & transport invoices) ---
  // labels may combine punctuation ("Поръчка №: 17") — № group + optional colon, both optional spacing
  const numSep = '\\s*(?:№|no\\.?|#)?\\s*:?\\s*';
  push('po_number', m(new RegExp(`(?:поръчка|purchase\\s*order|p\\.?o\\.?)${numSep}${idTok}`, 'i')) ?? '', 0.8);
  push('contract_number', m(new RegExp(`(?:договор|contract)${numSep}${idTok}`, 'i')) ?? '', 0.78);
  push('delivery_note_number', m(new RegExp(`(?:стокова\\s*разписка|складова\\s*разписка|приемо-?предавателен\\s*протокол|delivery\\s*note)${numSep}${idTok}`, 'i')) ?? '', 0.78);
  // BG plate (Cyrillic or Latin look-alike letters): labeled = confident; bare pattern = lower conf.
  const plate = '([АВЕКМНОРСТУХABEKMHOPCTYX]{1,2}\\s?\\d{4}\\s?[АВЕКМНОРСТУХABEKMHOPCTYX]{2})';
  const labeledPlate = m(new RegExp(`(?:рег\\.?\\s*№|мпс|автомобил|vehicle)\\s*[:#]?\\s*${plate}`, 'i'));
  const barePlate = labeledPlate ? undefined : m(new RegExp(plate));
  if (labeledPlate) push('vehicle_reg_number', labeledPlate.replace(/\s/g, ''), 0.85);
  else if (barePlate) push('vehicle_reg_number', barePlate.replace(/\s/g, ''), 0.62);

  // --- description / notes ---
  push('description', clean(m(/(?:описание|основание\s*за\s*сделка|description)\s*[:#]?\s*([^\n]{2,120}?)\s*(?:\n|забележка|notes?|ддс|vat|$)/i) ?? ''), 0.72);
  push('notes', clean(m(/(?:забележка|бележк[аи]|notes?|remark[s]?)\s*[:#]?\s*([^\n]{2,160}?)\s*(?:\n|$)/i) ?? ''), 0.7);

  // --- line items (summary count + raw JSON) ---
  // NB: no \b — JS word boundaries are ASCII-only and fail right after Cyrillic letters.
  const itemRe = /(?:артикул|item|ред|поз)[^\n]*?(\d+(?:[.,]\d+)?)\s*[xх*]\s*([\d., ]+\d)\s*=\s*([\d., ]+\d)/gi;
  const items: Array<{ qty: string; price: string; amount: string }> = [];
  for (let mm = itemRe.exec(text); mm; mm = itemRe.exec(text)) {
    items.push({ qty: norm(mm[1]), price: norm(mm[2]), amount: norm(mm[3]) });
  }
  if (items.length) push('line_items', String(items.length), 0.7, JSON.stringify(items));

  return f;
}
