#!/usr/bin/env node
/* eslint-disable */
// =====================================================================
// Extraction coverage measurement (Invoice extraction reliability).
// Runs the compiled extractor over a labeled corpus of realistic Bulgarian/EU
// invoices in BOTH shapes the system actually sees:
//   - "joined"  → born-digital PDFs as pdf.js emits them (text items space-joined,
//                 ~one newline per page) — the hard, real-world case;
//   - "lines"   → OCR / structured line output (newline per field).
// Computes per-field hit rate + the headline rates the task asks for, and prints
// a before/after-comparable table. Build the API first (npm run build), then:
//   node scripts/measure-extraction.js
// =====================================================================
const path = require('path');
const DIST = path.resolve(__dirname, '../dist/modules/docintel/domain/extraction');

// Prefer the new layered pipeline if present (AFTER); else current code (BEFORE).
let runExtraction, label;
try {
  const { extractAllLayers } = require(path.join(DIST, 'pipeline.js'));
  runExtraction = (text) => extractAllLayers(text).fields;
  label = 'AFTER (layered pipeline: text → heuristics → validation)';
} catch {
  const { extractFromText } = require(path.join(DIST, 'field-extractor.js'));
  const { applyValidation } = require(path.join(DIST, 'confidence.js'));
  runExtraction = (text) => applyValidation(extractFromText(text));
  label = 'BEFORE (extractFromText → applyValidation)';
}

// pdf.js-style rendering: join the field lines with spaces, page break => newline.
const joined = (lines) => lines.filter((l) => l !== '').join('  ') + '\n';
const linewise = (lines) => lines.join('\n');

// --- Corpus: realistic invoices + ground truth (required accounting fields) ---
const CORPUS = [
  {
    id: 'bg-borndigital-joined',
    shape: 'joined',
    lines: [
      'ФАКТУРА (ОРИГИНАЛ)', 'Фактура № 0000004821', 'Дата на издаване: 14.03.2026 г.',
      'Доставчик: Делта Софтуер ЕООД', 'ЕИК: 203150714', 'ДДС №: BG203150714',
      'Адрес: гр. София, бул. Витоша 15', 'Държава: България',
      'Получател: Акме Демо ООД', 'ЕИК на получателя: 200050001',
      'Данъчна основа: 1 250,00', 'ДДС 20%: 250,00', 'Общо за плащане: 1 500,00 BGN',
      'Срок за плащане: 28.03.2026 г.',
      'Банка: Уникредит Булбанк', 'IBAN: BG80UNCR70001234567890', 'BIC: UNCRBGSF',
      'Основание: Абонамент Q1 2026', 'Начин на плащане: Банков превод',
    ],
    truth: {
      invoice_number: '0000004821', invoice_date: '2026-03-14', due_date: '2026-03-28',
      supplier_name: 'Делта Софтуер ЕООД', supplier_eik: '203150714', supplier_vat: 'BG203150714',
      supplier_country: 'България', supplier_address: 'гр. София, бул. Витоша 15',
      net_amount: '1250.00', vat_amount: '250.00', total_amount: '1500.00', currency: 'BGN', vat_rate: '20',
      iban: 'BG80UNCR70001234567890', bank_name: 'Уникредит Булбанк', bank_bic: 'UNCRBGSF',
      payment_reference: 'Абонамент Q1 2026',
    },
  },
  {
    id: 'bg-itemized-notes',
    shape: 'lines',
    lines: [
      'ФАКТУРА', 'Документ №: ФБ-2026-0099', 'Тип документ: Фактура', 'Дата: 1 март 2026 г.',
      'Доставчик: Омега Консулт ООД', 'ЕИК: 175200118', 'ДДС №: BG175200118',
      'Адрес: гр. Варна, ул. Морска 3',
      'Описание: Счетоводни услуги за Q1', 'ДДС код: 20', 'Валута: EUR',
      'Артикул 1  Консултация  10.00 x 50.00 = 500.00',
      'Артикул 2  Обработка  1.00 x 100.00 = 100.00',
      'Данъчна основа: 600,00', 'ДДС 20%: 120,00', 'Общо за плащане: 720,00',
      'Забележка: Платима по банков път до 30 дни',
    ],
    truth: {
      invoice_number: 'ФБ-2026-0099', document_number: 'ФБ-2026-0099', document_type: 'Фактура',
      invoice_date: '2026-03-01',
      supplier_name: 'Омега Консулт ООД', supplier_eik: '175200118', supplier_vat: 'BG175200118',
      supplier_address: 'гр. Варна, ул. Морска 3',
      description: 'Счетоводни услуги за Q1', vat_code: '20', currency: 'EUR',
      net_amount: '600.00', vat_amount: '120.00', total_amount: '720.00', vat_rate: '20',
      notes: 'Платима по банков път до 30 дни',
      line_items: '2',
    },
  },
  {
    id: 'bg-ocr-lines',
    shape: 'lines',
    lines: [
      'ФАКТУРА', 'Номер: 1000002345', 'Дата: 2026/02/09', 'Валута: BGN',
      'Доставчик: Globex Trade EOOD', 'ЕИК: 131289092', 'ДДС №: BG131289092',
      'гр. Пловдив', 'Получател: Фирма 3', 'ЕИК на получателя: 3333333333',
      'Данъчна основа: 800,00', 'ДДС 20%: 160,00', 'Общо за плащане: 960,00',
      'IBAN: BG18RZBB91550123456789', 'Банка: Райфайзенбанк', 'BIC: RZBBBGSF',
    ],
    truth: {
      invoice_number: '1000002345', invoice_date: '2026-02-09', currency: 'BGN',
      supplier_name: 'Globex Trade EOOD', supplier_eik: '131289092', supplier_vat: 'BG131289092',
      net_amount: '800.00', vat_amount: '160.00', total_amount: '960.00', vat_rate: '20',
      iban: 'BG18RZBB91550123456789', bank_name: 'Райфайзенбанк', bank_bic: 'RZBBBGSF',
    },
  },
  {
    id: 'eu-latin-joined',
    shape: 'joined',
    lines: [
      'INVOICE', 'Invoice No: INV-2026-0455', 'Invoice date: 2026-01-22', 'Due date: 2026-02-21',
      'Supplier: Globex GmbH', 'VAT: DE811234567', 'Country: Germany',
      'Address: Hauptstrasse 12, 10115 Berlin',
      'Net: 2 000.00', 'VAT (19%): 380.00', 'Total: 2 380.00 EUR',
      'IBAN: DE89370400440532013000', 'Bank: Deutsche Bank', 'BIC: DEUTDEFF',
      'Reference: PO-99213',
    ],
    truth: {
      invoice_number: 'INV-2026-0455', invoice_date: '2026-01-22', due_date: '2026-02-21',
      supplier_name: 'Globex GmbH', supplier_vat: 'DE811234567', supplier_country: 'Germany',
      supplier_address: 'Hauptstrasse 12, 10115 Berlin',
      net_amount: '2000.00', vat_amount: '380.00', total_amount: '2380.00', currency: 'EUR', vat_rate: '19',
      iban: 'DE89370400440532013000', bank_name: 'Deutsche Bank', bank_bic: 'DEUTDEFF',
      payment_reference: 'PO-99213',
    },
  },
  {
    id: 'bg-missing-net-label',
    shape: 'lines',
    // Net label garbled/missing — only VAT + total present. Heuristic must derive net = total - vat
    // and vat_rate from vat/net. Tests layer-4 accounting derivation.
    lines: [
      'ФАКТУРА', 'Фактура № 7788', 'Дата: 03.04.2026',
      'Доставчик: Бета ЕООД', 'ЕИК: 205150714',
      'ДДС 20%: 300,00', 'Общо за плащане: 1 800,00 BGN',
    ],
    truth: {
      invoice_number: '7788', invoice_date: '2026-04-03',
      supplier_name: 'Бета ЕООД', supplier_eik: '205150714',
      vat_amount: '300.00', total_amount: '1800.00', currency: 'BGN',
      net_amount: '1500.00', vat_rate: '20', // derived
    },
  },
];

// numeric compare tolerant of formatting; others exact (trim/space-insensitive)
const numKeys = new Set(['net_amount', 'vat_amount', 'total_amount', 'vat_rate']);
function hit(key, got, want) {
  if (got == null) return false;
  if (numKeys.has(key)) return Math.abs(parseFloat(String(got)) - parseFloat(String(want))) < 0.005;
  return String(got).replace(/\s+/g, ' ').trim().toUpperCase() === String(want).replace(/\s+/g, ' ').trim().toUpperCase();
}

const allKeys = new Set();
CORPUS.forEach((c) => Object.keys(c.truth).forEach((k) => allKeys.add(k)));

let totalWanted = 0, totalHit = 0;
const perKey = {};
const cat = { vat: [0, 0], supplier: [0, 0], invoiceNo: [0, 0], amounts: [0, 0] };
const amountKeys = new Set(['net_amount', 'vat_amount', 'total_amount', 'currency']);
const vatKeys = new Set(['vat_amount', 'vat_rate']);
const supplierKeys = new Set(['supplier_name', 'supplier_eik', 'supplier_vat', 'supplier_country', 'supplier_address']);

console.log('\n=== Extraction measurement — ' + label + ' ===\n');
for (const doc of CORPUS) {
  const text = doc.shape === 'joined' ? joined(doc.lines) : linewise(doc.lines);
  const fields = runExtraction(text);
  const byKey = {};
  for (const f of fields) byKey[f.key] = f.valueText;
  let dHit = 0, dWant = 0;
  for (const [k, want] of Object.entries(doc.truth)) {
    dWant++; totalWanted++;
    perKey[k] = perKey[k] || [0, 0];
    perKey[k][1]++;
    const ok = hit(k, byKey[k], want);
    if (ok) { dHit++; totalHit++; perKey[k][0]++; }
    if (vatKeys.has(k)) { cat.vat[1]++; if (ok) cat.vat[0]++; }
    if (supplierKeys.has(k)) { cat.supplier[1]++; if (ok) cat.supplier[0]++; }
    if (k === 'invoice_number') { cat.invoiceNo[1]++; if (ok) cat.invoiceNo[0]++; }
    if (amountKeys.has(k)) { cat.amounts[1]++; if (ok) cat.amounts[0]++; }
  }
  console.log(`  ${doc.id.padEnd(26)} ${dHit}/${dWant} fields`);
}

const pct = (a, b) => (b === 0 ? '  n/a' : ((100 * a) / b).toFixed(1).padStart(5) + '%');
console.log('\n  --- headline rates ---');
console.log(`  overall field extraction : ${pct(totalHit, totalWanted)}  (${totalHit}/${totalWanted})`);
console.log(`  VAT extraction           : ${pct(cat.vat[0], cat.vat[1])}`);
console.log(`  supplier identification  : ${pct(cat.supplier[0], cat.supplier[1])}`);
console.log(`  invoice number accuracy  : ${pct(cat.invoiceNo[0], cat.invoiceNo[1])}`);
console.log(`  amount accuracy          : ${pct(cat.amounts[0], cat.amounts[1])}`);

console.log('\n  --- per-field hit rate ---');
[...allKeys].sort().forEach((k) => {
  const [h, w] = perKey[k] || [0, 0];
  console.log(`  ${k.padEnd(20)} ${pct(h, w)}  (${h}/${w})`);
});
console.log('');
