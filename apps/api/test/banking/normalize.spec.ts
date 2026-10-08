import { parseAmount, parseDate, normalizeRow, dedupKey } from '../../src/modules/banking/domain/normalize';

describe('parseAmount (Task 3.2)', () => {
  it('parses US notation', () => {
    expect(parseAmount('1234.56')).toBe('1234.56');
    expect(parseAmount('1,234.56')).toBe('1234.56');
  });
  it('parses EU notation (comma decimal, dot thousands)', () => {
    expect(parseAmount('1.234,56')).toBe('1234.56');
    expect(parseAmount('1234,56')).toBe('1234.56');
  });
  it('parses negatives and parentheses', () => {
    expect(parseAmount('-300.00')).toBe('-300.00');
    expect(parseAmount('(300,00)')).toBe('-300.00');
  });
  it('strips currency symbols/spaces', () => {
    expect(parseAmount(' 1 200,00 EUR ')).toBe('1200.00');
  });
  it('throws on garbage', () => {
    expect(() => parseAmount('abc')).toThrow();
    expect(() => parseAmount('')).toThrow();
  });
});

describe('parseDate (Task 3.2)', () => {
  it('accepts ISO + EU formats', () => {
    expect(parseDate('2026-05-14')).toBe('2026-05-14');
    expect(parseDate('14.05.2026')).toBe('2026-05-14');
    expect(parseDate('14/05/2026')).toBe('2026-05-14');
  });
  it('throws on invalid date', () => {
    expect(() => parseDate('not-a-date')).toThrow();
  });
});

describe('normalizeRow (Task 3.2)', () => {
  it('normalizes a valid row and derives direction from sign', () => {
    const { row, errors } = normalizeRow({ date: '2026-05-14', amount: '1200,00', currency: 'eur', counterparty_name: 'ACME OOD', reference: 'INV 2026-0001' }, 1);
    expect(errors).toHaveLength(0);
    expect(row).toMatchObject({ bookingDate: '2026-05-14', amount: '1200.00', currency: 'EUR', transactionType: 'inbound', reference: 'INV 2026-0001' });
  });
  it('marks outbound for negative amounts', () => {
    expect(normalizeRow({ date: '2026-05-14', amount: '-300.00' }, 1).row!.transactionType).toBe('outbound');
  });
  it('returns clear errors for invalid rows', () => {
    const { row, errors } = normalizeRow({ date: 'bad', amount: 'nope' }, 7);
    expect(row).toBeUndefined();
    expect(errors.map((e) => e.field).sort()).toEqual(['amount', 'date']);
    expect(errors[0].row).toBe(7);
  });
  it('rejects a zero amount', () => {
    expect(normalizeRow({ date: '2026-05-14', amount: '0.00' }, 1).errors[0].message).toMatch(/Нулева/);
  });
});

describe('dedupKey (Task 3.2)', () => {
  it('is stable for identical rows and differs on amount', () => {
    const a = normalizeRow({ date: '2026-05-14', amount: '100.00', reference: 'X' }, 1).row!;
    const b = normalizeRow({ date: '2026-05-14', amount: '100.00', reference: 'X' }, 2).row!;
    const c = normalizeRow({ date: '2026-05-14', amount: '101.00', reference: 'X' }, 3).row!;
    expect(dedupKey(a)).toBe(dedupKey(b));
    expect(dedupKey(a)).not.toBe(dedupKey(c));
  });
});
