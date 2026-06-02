import { extractFromText } from '../../src/modules/docintel/domain/extraction/field-extractor';
import { extractFromXml } from '../../src/modules/docintel/domain/extraction/xml-extractor';
import { applyValidation, overallConfidence, reviewFlags } from '../../src/modules/docintel/domain/extraction/confidence';
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
