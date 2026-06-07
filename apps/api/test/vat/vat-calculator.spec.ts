import { classifyEntry, treatmentFromRate, summarize, buildReturnDataset, validate } from '../../src/modules/tax/domain/vat/calculator';
import type { PostedEntry, RegisterRow } from '../../src/modules/tax/domain/vat/models';

const purchaseEntry: PostedEntry = { journalEntryId: 'p', entryNo: 1, postingDate: '2026-04-10', lines: [
  { code: '602', direction: 'debit', amount: '200.00' }, { code: '4531', direction: 'debit', amount: '40.00' }, { code: '401', direction: 'credit', amount: '240.00' }] };
const salesEntry: PostedEntry = { journalEntryId: 's', entryNo: 2, postingDate: '2026-04-20', lines: [
  { code: '411', direction: 'debit', amount: '360.00' }, { code: '702', direction: 'credit', amount: '300.00' }, { code: '4532', direction: 'credit', amount: '60.00' }] };

const withTreatment = (e: PostedEntry, vatCodeId?: string): RegisterRow => {
  const base = classifyEntry(e); const { rate, treatment } = treatmentFromRate(base.base, base.vat);
  return { ...base, rate, treatment, vatCodeId };
};

describe('purchase VAT', () => {
  it('classifies base 200 / vat 40 / deductible 40', () => {
    expect(classifyEntry(purchaseEntry)).toMatchObject({ kind: 'purchase', base: 200, vat: 40, deductible: 40 });
  });
});
describe('sales VAT', () => {
  it('classifies base 300 / vat 60 / deductible 0', () => {
    expect(classifyEntry(salesEntry)).toMatchObject({ kind: 'sales', base: 300, vat: 60, deductible: 0 });
  });
});

// --- Task 2.2: credit notes (reverse) / debit notes (increase) / proforma (no posting) ---
const creditNoteEntry: PostedEntry = { journalEntryId: 'cn', entryNo: 3, postingDate: '2026-04-25', lines: [
  { code: '702', direction: 'debit', amount: '300.00' }, { code: '4532', direction: 'debit', amount: '60.00' }, { code: '411', direction: 'credit', amount: '360.00' }] };
const debitNoteEntry: PostedEntry = { journalEntryId: 'dn', entryNo: 4, postingDate: '2026-04-26', lines: [
  { code: '411', direction: 'debit', amount: '120.00' }, { code: '702', direction: 'credit', amount: '100.00' }, { code: '4532', direction: 'credit', amount: '20.00' }] };

describe('credit / debit notes (signed registers)', () => {
  it('credit note classifies as NEGATIVE sales (base -300 / vat -60)', () => {
    expect(classifyEntry(creditNoteEntry)).toMatchObject({ kind: 'sales', base: -300, vat: -60, deductible: 0 });
  });
  it('credit note still maps to the 20% standard treatment (by magnitude)', () => {
    const c = classifyEntry(creditNoteEntry);
    expect(treatmentFromRate(c.base, c.vat)).toEqual({ rate: 20, treatment: 'standard' });
  });
  it('debit note classifies as POSITIVE sales (base +100 / vat +20)', () => {
    expect(classifyEntry(debitNoteEntry)).toMatchObject({ kind: 'sales', base: 100, vat: 20, deductible: 0 });
  });
  it('an invoice fully credited nets to zero output VAT', () => {
    const s = summarize([withTreatment(salesEntry), withTreatment(creditNoteEntry)]);
    expect(s.outputVat).toBe(0);
  });
  it('invoice + debit note increases output VAT (60 + 20 = 80)', () => {
    const s = summarize([withTreatment(salesEntry), withTreatment(debitNoteEntry)]);
    expect(s.outputVat).toBe(80);
  });
});
describe('deductible VAT & VAT payable', () => {
  it('output 60 − deductible 40 = payable 20', () => {
    const s = summarize([withTreatment(purchaseEntry), withTreatment(salesEntry)]);
    expect(s).toEqual({ outputVat: 60, deductibleVat: 40, vatPayable: 20, vatRefundable: 0 });
  });
  it('produces a refundable position when input exceeds output', () => {
    const rows: RegisterRow[] = [
      { journalEntryId: 'a', kind: 'purchase', base: 500, vat: 100, deductible: 100, treatment: 'standard', rate: 20 },
      { journalEntryId: 'b', kind: 'sales', base: 150, vat: 30, deductible: 0, treatment: 'standard', rate: 20 }];
    expect(summarize(rows)).toMatchObject({ vatPayable: 0, vatRefundable: 70 });
  });
});
describe('VAT return dataset', () => {
  it('fills the СД cells', () => {
    const rows = [withTreatment(purchaseEntry), withTreatment(salesEntry)];
    const ds = buildReturnDataset(rows, summarize(rows));
    expect(ds.cell50_outputVat).toBe('60.00');
    expect(ds.cell40_vatPayable).toBe('20.00');
    expect(ds.cell11_taxableBaseSales).toBe('300.00');
  });
});
describe('VAT validation', () => {
  it('flags duplicate, missing VAT code, invalid treatment', () => {
    const rows: RegisterRow[] = [
      { journalEntryId: 'p', kind: 'purchase', base: 200, vat: 40, deductible: 40, treatment: 'standard', rate: 20, vatCodeId: 'v1' },
      { journalEntryId: 'p', kind: 'purchase', base: 200, vat: 40, deductible: 40, treatment: 'standard', rate: 20, vatCodeId: 'v1' },
      { journalEntryId: 'q', kind: 'purchase', base: 100, vat: 20, deductible: 20, treatment: 'standard', rate: 20 },
      { journalEntryId: 'r', kind: 'sales', base: 100, vat: 20, deductible: 0, treatment: 'weird' as RegisterRow['treatment'], rate: 20, vatCodeId: 'v1' }];
    const issues = validate(rows).map((i) => i.code);
    expect(issues).toContain('duplicate');
    expect(issues).toContain('missing_vat_code');
    expect(issues).toContain('invalid_treatment');
  });
});
