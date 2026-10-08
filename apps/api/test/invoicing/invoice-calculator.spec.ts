import { buildPostingPlan, computeLine, computeTotals, formatInvoiceNumber, numberPrefixFor, validateForIssue, InvoiceValidationError } from '../../src/modules/invoicing/domain/invoice/calculator';

describe('invoice line math (exact cents)', () => {
  it('1 × 300.00 @20% → net 300.00, vat 60.00, gross 360.00', () => {
    expect(computeLine({ description: 'x', quantity: '1', unitPrice: '300.00', vatRate: '20' })).toEqual({ net: '300.00', vat: '60.00', gross: '360.00' });
  });
  it('3 × 99.99 @20% → 299.97 / 59.99 / 359.96 (no float drift)', () => {
    expect(computeLine({ description: 'x', quantity: '3', unitPrice: '99.99', vatRate: '20' })).toEqual({ net: '299.97', vat: '59.99', gross: '359.96' });
  });
  it('zero-rated line → vat 0', () => {
    expect(computeLine({ description: 'x', quantity: '2', unitPrice: '50.00', vatRate: '0' })).toEqual({ net: '100.00', vat: '0.00', gross: '100.00' });
  });
});

describe('invoice totals', () => {
  it('sums lines exactly', () => {
    expect(computeTotals([{ netAmount: '300.00', vatAmount: '60.00' }, { netAmount: '299.97', vatAmount: '59.99' }])).toEqual({ net: '599.97', vat: '119.99', gross: '719.96' });
  });
});

describe('sequential / gapless numbering format', () => {
  it('formats padded numbers', () => {
    expect(formatInvoiceNumber('2026-', 1)).toBe('2026-0001');
    expect(formatInvoiceNumber('2026-', 42)).toBe('2026-0042');
    expect(formatInvoiceNumber('2026-', 1000)).toBe('2026-1000');
  });
});

describe('validate before issue', () => {
  const line = { description: 'Consulting', quantity: '1', unitPrice: '300.00', vatRate: '20' };
  it('passes a complete draft', () => {
    expect(() => validateForIssue({ customerName: 'Beta EOOD', lines: [line] })).not.toThrow();
  });
  it('requires a customer', () => {
    expect(() => validateForIssue({ lines: [line] })).toThrow(InvoiceValidationError);
  });
  it('requires at least one line', () => {
    expect(() => validateForIssue({ customerName: 'Beta', lines: [] })).toThrow(/at least one line/);
  });
  it('rejects non-positive quantity', () => {
    expect(() => validateForIssue({ customerName: 'Beta', lines: [{ ...line, quantity: '0' }] })).toThrow(/quantity/);
  });
});

// --- Task 2.2: per-kind numbering + kind-aware posting plan ---
describe('document numbering prefixes per kind', () => {
  it('uses a distinct prefix for each kind', () => {
    expect(numberPrefixFor('invoice', 2026)).toBe('2026-');
    expect(numberPrefixFor('credit_note', 2026)).toBe('КИ-2026-');
    expect(numberPrefixFor('debit_note', 2026)).toBe('ДИ-2026-');
    expect(numberPrefixFor('proforma', 2026)).toBe('ПФ-2026-');
  });
});

describe('posting plan per document kind', () => {
  const totals = { net: '300.00', vat: '60.00', gross: '360.00' };
  it('invoice: Dr receivable(gross) / Cr revenue(net) / Cr vatOutput(vat)', () => {
    expect(buildPostingPlan('invoice', totals)).toEqual([
      { role: 'receivable', direction: 'debit', amount: '360.00' },
      { role: 'revenue', direction: 'credit', amount: '300.00' },
      { role: 'vatOutput', direction: 'credit', amount: '60.00' },
    ]);
  });
  it('debit note posts like an invoice (increase)', () => {
    expect(buildPostingPlan('debit_note', totals)).toEqual(buildPostingPlan('invoice', totals));
  });
  it('credit note reverses: Dr revenue + Dr vatOutput / Cr receivable', () => {
    expect(buildPostingPlan('credit_note', totals)).toEqual([
      { role: 'revenue', direction: 'debit', amount: '300.00' },
      { role: 'vatOutput', direction: 'debit', amount: '60.00' },
      { role: 'receivable', direction: 'credit', amount: '360.00' },
    ]);
  });
  it('proforma posts NOTHING', () => {
    expect(buildPostingPlan('proforma', totals)).toBeNull();
  });
  it('omits the VAT line when there is no VAT', () => {
    const plan = buildPostingPlan('invoice', { net: '100.00', vat: '0.00', gross: '100.00' });
    expect(plan).toHaveLength(2);
    expect(plan!.some((l) => l.role === 'vatOutput')).toBe(false);
  });
});
