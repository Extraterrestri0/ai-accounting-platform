import { monthBounds, entryBalanced, purchaseAmounts, buildHeader, SOFTWARE_NAME } from '../../src/modules/saft/domain/assemble';
import { validateDataset } from '../../src/modules/saft/domain/validation';
import type { SaftDataset, SaftGlLine } from '../../src/modules/saft/domain/models';

const line = (account: string, debit: string, credit: string): SaftGlLine => ({ lineNumber: 1, accountCode: account, debit, credit });

describe('SAF-T assemble helpers', () => {
  it('computes month bounds (incl. leap year February)', () => {
    expect(monthBounds(2026, 5)).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    expect(monthBounds(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
  it('detects balanced vs unbalanced entries', () => {
    expect(entryBalanced([line('411', '120.00', '0.00'), line('702', '0.00', '100.00'), line('4532', '0.00', '20.00')])).toBe(true);
    expect(entryBalanced([line('411', '120.00', '0.00'), line('702', '0.00', '100.00')])).toBe(false);
  });
  it('derives purchase net/VAT/gross from posted lines (mapped account codes)', () => {
    const lines = [line('602', '200.00', '0.00'), line('4531', '40.00', '0.00'), line('401', '0.00', '240.00')];
    expect(purchaseAmounts(lines, '401', '4531')).toEqual({ net: '200.00', vat: '40.00', gross: '240.00' });
  });
  it('builds a header with period + software metadata', () => {
    const h = buildHeader({ companyName: 'ACME', eik: '123', vatNumber: 'BG123', currency: 'EUR', year: 2026, month: 5, generatedAt: '2026-06-01T00:00:00Z' });
    expect(h).toMatchObject({ companyName: 'ACME', vatNumber: 'BG123', currency: 'EUR', softwareName: SOFTWARE_NAME });
    expect(h.period).toEqual({ year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' });
  });
});

function dataset(over: Partial<SaftDataset> = {}): SaftDataset {
  return {
    header: { companyName: 'ACME', vatNumber: 'BG123', period: { year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' }, currency: 'EUR', softwareName: 'x', softwareVersion: '1', generatedAt: 'now' },
    masterFiles: { customers: [], suppliers: [], products: [], accounts: [], taxCodes: [{ vatCode: 'STD20', vatRate: '20', vatTreatment: 'standard', direction: 'both', saftTaxCode: 'S' }] },
    generalLedgerEntries: [], sourceDocuments: { salesInvoices: [], purchaseDocuments: [], payments: [] },
    counts: { customers: 0, suppliers: 0, products: 0, accounts: 0, taxCodes: 1, glEntries: 0, salesInvoices: 0, purchaseDocuments: 0, payments: 0 },
    ...over,
  };
}

describe('SAF-T validation', () => {
  it('flags an unbalanced ledger entry as an ERROR (ok=false)', () => {
    const ds = dataset({ generalLedgerEntries: [{ journalEntryId: 'e1', entryNo: 1, postingDate: '2026-05-10', documentReference: 'INV-1', sourceType: 'invoice', lines: [line('411', '120.00', '0.00'), line('702', '0.00', '100.00')] }] });
    const v = validateDataset(ds);
    expect(v.ok).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain('gl_unbalanced');
  });
  it('warns on missing company + customer VAT numbers (does not block)', () => {
    const ds = dataset({ header: { ...dataset().header, vatNumber: undefined }, masterFiles: { ...dataset().masterFiles, customers: [{ id: 'c1', name: 'X', country: 'BG' }] } });
    const v = validateDataset(ds);
    expect(v.ok).toBe(true); // warnings only
    const codes = v.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['company_vat_missing', 'customer_vat_missing']));
  });
  it('reports missing SAF-T codes as INFO', () => {
    const ds = dataset({ masterFiles: { ...dataset().masterFiles, accounts: [{ accountCode: '702', accountName: 'Rev', accountType: 'revenue' }] } });
    const v = validateDataset(ds);
    expect(v.info.map((i) => i.code)).toContain('saft_codes_missing');
  });
  it('a clean balanced dataset has no errors', () => {
    const ds = dataset({ header: { ...dataset().header, vatNumber: 'BG123' }, generalLedgerEntries: [{ journalEntryId: 'e1', entryNo: 1, postingDate: '2026-05-10', documentReference: 'INV-1', sourceType: 'invoice', lines: [line('411', '120.00', '0.00'), line('702', '0.00', '100.00'), line('4532', '0.00', '20.00')] }], sourceDocuments: { salesInvoices: [{ invoiceNumber: '1', netAmount: '100.00', vatAmount: '20.00', grossAmount: '120.00', documentType: 'invoice', vatCode: 'STD20' }], purchaseDocuments: [], payments: [] } });
    const v = validateDataset(ds);
    expect(v.ok).toBe(true);
    expect(v.counts.errors).toBe(0);
  });
});
