import { ymOf, periodKey, nextMonth, prevMonth, recentMonths, assertValidYm } from '../../src/modules/periods/domain/period';

describe('period helpers (Task 4.3)', () => {
  it('extracts year/month from an ISO date or datetime', () => {
    expect(ymOf('2026-06-06')).toEqual({ year: 2026, month: 6 });
    expect(ymOf('2026-01-31T23:59:59.000Z')).toEqual({ year: 2026, month: 1 });
  });
  it('rejects an invalid accounting date', () => {
    expect(() => ymOf('2026-13-01')).toThrow();
    expect(() => ymOf('not-a-date')).toThrow();
  });
  it('formats the period key', () => {
    expect(periodKey(2026, 6)).toBe('2026-06');
    expect(periodKey(2026, 12)).toBe('2026-12');
  });
  it('rolls month boundaries', () => {
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
    expect(nextMonth(2026, 6)).toEqual({ year: 2026, month: 7 });
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(prevMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });
  it('builds a descending window of recent months', () => {
    const w = recentMonths(2026, 2, 3);
    expect(w).toEqual([{ year: 2026, month: 2 }, { year: 2026, month: 1 }, { year: 2025, month: 12 }]);
  });
  it('validates year/month bounds', () => {
    expect(() => assertValidYm(2026, 6)).not.toThrow();
    expect(() => assertValidYm(2026, 0)).toThrow();
    expect(() => assertValidYm(2026, 13)).toThrow();
    expect(() => assertValidYm(1999, 6)).toThrow();
  });
});
