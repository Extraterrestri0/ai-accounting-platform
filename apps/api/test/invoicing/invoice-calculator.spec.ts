import { computeLine, computeTotals, formatInvoiceNumber, validateForIssue, InvoiceValidationError } from '../../src/modules/invoicing/domain/invoice/calculator';

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
