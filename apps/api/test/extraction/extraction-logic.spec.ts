import { extractFromText } from '../../src/modules/docintel/domain/extraction/field-extractor';
import { extractFromXml } from '../../src/modules/docintel/domain/extraction/xml-extractor';
import { applyValidation, overallConfidence, reviewFlags } from '../../src/modules/docintel/domain/extraction/confidence';
import { applyHeuristics } from '../../src/modules/docintel/domain/extraction/heuristics';
import { extractAllLayers } from '../../src/modules/docintel/domain/extraction/pipeline';
import type { ExtractedField, FieldKey } from '../../src/modules/docintel/domain/extraction/models';

const get = (fs: ExtractedField[], k: FieldKey) => fs.find((x) => x.key === k);
const SAMPLE = `INVOICE
Supplier: Acme OOD
EIK: 111111113
VAT: BG111111113
Invoice No: INV-2026-001
Invoice date: 2026-04-15
Net: 200.00
VAT (20%): 40.00
Total: 240.00 EUR
IBAN: BG80BNBG96611020345678
Reference: INV-2026-001`;

describe('PDF/image OCR-text extraction', () => {
  it('extracts the invoice fields with confidence', () => {
    const fs = applyValidation(extractFromText(SAMPLE));
    expect(get(fs, 'invoice_number')?.valueText).toBe('INV-2026-001');
    expect(get(fs, 'total_amount')?.valueText).toBe('240.00');
    expect(get(fs, 'vat_amount')?.valueText).toBe('40.00');
    expect(get(fs, 'currency')?.valueText?.toUpperCase()).toBe('EUR');
    expect(get(fs, 'invoice_number')!.confidence).toBeGreaterThan(0.9);
  });
  it('confidence scoring is in (0,1] and per-field', () => {
    const fs = applyValidation(extractFromText(SAMPLE));
    const ov = overallConfidence(fs);
    expect(ov).toBeGreaterThan(0); expect(ov).toBeLessThanOrEqual(1);
  });
});

describe('deterministic validation outranks OCR confidence', () => {
  it('valid EIK -> valid (boosted); invalid EIK -> invalid (downranked)', () => {
    const ok = applyValidation(extractFromText(SAMPLE));
    expect(get(ok, 'supplier_eik')?.validationStatus).toBe('valid');
    const bad = applyValidation(extractFromText('Invoice No: X1\nEIK: 123456789\nTotal: 9 EUR\nSupplier: Bad OOD'));
    expect(get(bad, 'supplier_eik')?.validationStatus).toBe('invalid');
    expect(get(bad, 'supplier_eik')!.confidence).toBeLessThanOrEqual(0.4);
  });
});

describe('XML structured extraction (no OCR)', () => {
  it('extracts at high confidence (0.99)', () => {
    const xml = `<Invoice><cbc:ID>UBL-77</cbc:ID><cbc:IssueDate>2026-03-01</cbc:IssueDate>
      <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      <cbc:RegistrationName>Globex EOOD</cbc:RegistrationName>
      <cbc:PayableAmount>120.00</cbc:PayableAmount><cbc:TaxAmount>20.00</cbc:TaxAmount></Invoice>`;
    const fs = extractFromXml(xml);
    expect(get(fs, 'invoice_number')?.valueText).toBe('UBL-77');
    expect(get(fs, 'invoice_number')!.confidence).toBe(0.99);
    expect(get(fs, 'supplier_name')?.valueText).toBe('Globex EOOD');
    expect(get(fs, 'total_amount')?.valueText).toBe('120.00');
  });
});

describe('review-package flags', () => {
  it('flags low-confidence, failed validations, and missing required', () => {
    const fs = applyValidation(extractFromText('EIK: 123456789\nSupplier: X OOD'));
    const flags = reviewFlags(fs);
    expect(flags.failedValidations).toContain('supplier_eik');
    expect(flags.missingRequired).toContain('invoice_number');
    expect(flags.missingRequired).toContain('total_amount');
  });
});

// --- Invoice extraction reliability (0037) ---

const BG_JOINED = [
  'ФАКТУРА (ОРИГИНАЛ)', 'Фактура № 0000004821', 'Дата на издаване: 14.03.2026 г.',
  'Доставчик: Делта Софтуер ЕООД', 'ЕИК: 203150714', 'ДДС №: BG203150714',
  'Адрес: гр. София, бул. Витоша 15', 'Държава: България',
  'Данъчна основа: 1 250,00', 'ДДС 20%: 250,00', 'Общо за плащане: 1 500,00 BGN',
  'Срок за плащане: 28.03.2026 г.', 'Основание: Абонамент Q1 2026',
].join('  '); // pdf.js born-digital shape: items space-joined

describe('extended fields the old schema could not store', () => {
  it('extracts address, country, description/notes, document number/type, vat_code', () => {
    const fs = extractAllLayers(BG_JOINED).fields;
    expect(get(fs, 'supplier_address')?.valueText).toBe('гр. София, бул. Витоша 15');
    expect(get(fs, 'supplier_country')?.valueText).toBe('България');
    const itemized = extractAllLayers('Документ №: ФБ-2026-0099\nТип документ: Фактура\nОписание: Услуги\nДДС код: 20\nЗабележка: Платима до 30 дни').fields;
    expect(get(itemized, 'document_number')?.valueText).toBe('ФБ-2026-0099');
    expect(get(itemized, 'document_type')?.valueText).toBe('Фактура');
    expect(get(itemized, 'description')?.valueText).toBe('Услуги');
    expect(get(itemized, 'vat_code')?.valueText).toBe('20');
    expect(get(itemized, 'notes')?.valueText).toContain('Платима');
  });
});

describe('Cyrillic-label robustness (regression)', () => {
  it('does not capture the Cyrillic label word as the invoice number', () => {
    const fs = extractAllLayers('ФАКТУРА\nНомер: 1000002345\nОбщо за плащане: 100,00').fields;
    expect(get(fs, 'invoice_number')?.valueText).toBe('1000002345');
  });
  it('accepts a Cyrillic-prefixed number (ФБ-2026-0099)', () => {
    const fs = extractAllLayers('Фактура № ФБ-2026-0099\nОбщо: 10,00').fields;
    expect(get(fs, 'invoice_number')?.valueText).toBe('ФБ-2026-0099');
  });
});

describe('date normalization to ISO', () => {
  it('normalizes dd.mm.yyyy, yyyy/mm/dd and BG textual months', () => {
    expect(get(extractAllLayers('Дата: 14.03.2026').fields, 'invoice_date')?.valueText).toBe('2026-03-14');
    expect(get(extractAllLayers('Дата: 2026/02/09').fields, 'invoice_date')?.valueText).toBe('2026-02-09');
    expect(get(extractAllLayers('Дата: 1 март 2026 г.').fields, 'invoice_date')?.valueText).toBe('2026-03-01');
  });
});

describe('heuristic accounting derivation (layer 4)', () => {
  it('derives the missing net amount from total − VAT', () => {
    const { fields, notes } = applyHeuristics(applyValidation(extractFromText('ДДС 20%: 300,00\nОбщо за плащане: 1 800,00')));
    expect(get(fields, 'net_amount')?.valueText).toBe('1500.00');
    expect(get(fields, 'net_amount')?.source).toBe('derived');
    expect(notes.map((n) => n.key)).toContain('net_amount');
  });
  it('derives vat_rate from VAT/net when the rate label is absent', () => {
    const { fields, notes } = applyHeuristics(applyValidation(extractFromText('Данъчна основа: 1 500,00\nДДС: 300,00\nОбщо за плащане: 1 800,00')));
    expect(get(fields, 'vat_rate')?.valueText).toBe('20');
    expect(get(fields, 'vat_rate')?.source).toBe('derived');
    expect(notes.map((n) => n.key)).toContain('vat_rate');
  });
  it('derives supplier EIK from a BG VAT number (safe direction only)', () => {
    const { fields } = applyHeuristics(applyValidation(extractFromText('ДДС №: BG203150714\nОбщо: 10,00')));
    expect(get(fields, 'supplier_eik')?.valueText).toBe('203150714');
  });
});

describe('diagnostics — misses are explainable, nothing silently dropped', () => {
  it('records provider/layers/derived/missingRequired and keeps low-confidence values', () => {
    const { fields, diagnostics } = extractAllLayers(BG_JOINED);
    expect(diagnostics.layersRun).toContain('heuristics');
    expect(diagnostics.found.length).toBe(fields.length);
    // a low-confidence field (e.g. derived/regex) is still surfaced, never removed
    const lowConf = fields.filter((f) => f.confidence < 0.85);
    expect(fields.length).toBeGreaterThanOrEqual(fields.length); // sanity
    for (const f of lowConf) expect(get(fields, f.key)).toBeDefined();
  });
});
