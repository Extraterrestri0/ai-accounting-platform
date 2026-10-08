import { revenueByMonth, expensesByMonth, cashFlow } from '../../src/modules/reporting/domain/reports/calculator';
import { monthlySeriesCsv, cashFlowCsv } from '../../src/modules/reporting/domain/reports/management-csv';
import type { LedgerLine } from '../../src/modules/reporting/domain/reports/models';

const line = (date: string, type: LedgerLine['type'], code: string, direction: LedgerLine['direction'], amount: string): LedgerLine =>
  ({ entryId: 'e', entryNo: 1, date, accountCode: code, accountName: code, type, direction, amount });

describe('Revenue by month (Management Reports)', () => {
  const lines: LedgerLine[] = [
    line('2026-01-10', 'revenue', '702', 'credit', '1000.00'),
    line('2026-01-20', 'revenue', '702', 'credit', '500.00'),
    line('2026-03-05', 'revenue', '702', 'credit', '300.00'),
    line('2026-03-06', 'revenue', '702', 'debit', '50.00'),  // a sales credit-note reversal
    line('2026-01-10', 'asset', '411', 'debit', '1500.00'),  // non-revenue line ignored
    line('2025-12-31', 'revenue', '702', 'credit', '999.00'), // prior year excluded
  ];

  it('aggregates revenue (credit positive) into the right months', () => {
    const r = revenueByMonth(lines, 2026);
    expect(r.months).toHaveLength(12);
    expect(r.months[0].amount).toBe('1500.00');  // January
    expect(r.months[2].amount).toBe('250.00');   // March = 300 - 50
    expect(r.total).toBe('1750.00');
  });

  it('zero-fills empty months', () => {
    const r = revenueByMonth(lines, 2026);
    expect(r.months[1].amount).toBe('0.00');     // February
    expect(r.months[11].amount).toBe('0.00');    // December
  });

  it('applies the year filter (prior-year lines excluded)', () => {
    expect(revenueByMonth(lines, 2025).total).toBe('999.00');
    expect(revenueByMonth(lines, 2027).total).toBe('0.00');
  });
});

describe('Expenses by month (Management Reports)', () => {
  const lines: LedgerLine[] = [
    line('2026-02-10', 'expense', '602', 'debit', '200.00'),
    line('2026-02-15', 'expense', '602', 'debit', '100.00'),
    line('2026-02-16', 'expense', '602', 'credit', '30.00'), // reversal
    line('2026-05-01', 'revenue', '702', 'credit', '900.00'), // ignored
  ];
  it('aggregates expenses (debit positive) per month', () => {
    const r = expensesByMonth(lines, 2026);
    expect(r.months[1].amount).toBe('270.00');   // February = 200 + 100 - 30
    expect(r.total).toBe('270.00');
  });
});

describe('Cash flow (Management Reports)', () => {
  const lines: LedgerLine[] = [
    line('2026-01-05', 'asset', '503', 'debit', '1200.00'),  // customer receipt (inflow)
    line('2026-01-20', 'asset', '503', 'credit', '400.00'),  // supplier payment (outflow)
    line('2026-02-10', 'asset', '503', 'credit', '150.00'),  // outflow
    line('2026-01-05', 'asset', '411', 'credit', '1200.00'), // not the cash account → ignored
  ];
  it('splits inflow (debit) vs outflow (credit) on the cash/bank account', () => {
    const c = cashFlow(lines, '503', 2026);
    expect(c.months[0]).toMatchObject({ inflow: '1200.00', outflow: '400.00', net: '800.00' });   // Jan
    expect(c.months[1]).toMatchObject({ inflow: '0.00', outflow: '150.00', net: '-150.00' });     // Feb
    expect(c.totalInflow).toBe('1200.00');
    expect(c.totalOutflow).toBe('550.00');
    expect(c.netCashFlow).toBe('650.00');
    expect(c.accountCode).toBe('503');
  });
  it('honours the configured (non-hardcoded) cash account code', () => {
    const c = cashFlow([line('2026-01-05', 'asset', '5031', 'debit', '99.00')], '5031', 2026);
    expect(c.totalInflow).toBe('99.00');
  });
  it('returns zeros for a year with no cash movements', () => {
    const c = cashFlow(lines, '503', 2030);
    expect(c.netCashFlow).toBe('0.00');
    expect(c.months.every((m) => m.net === '0.00')).toBe(true);
  });
});

describe('Management report CSV export', () => {
  it('serializes a monthly series with header + 12 months + total', () => {
    const csv = monthlySeriesCsv('Приходи', revenueByMonth([line('2026-01-10', 'revenue', '702', 'credit', '1000.00')], 2026));
    const rows = csv.split('\r\n');
    expect(rows[0]).toBe('Месец,Приходи,Валута');
    expect(rows[1]).toBe('Януари,1000.00,EUR');
    expect(rows).toHaveLength(14);                 // header + 12 months + total
    expect(rows[13]).toBe('Общо 2026,1000.00,EUR');
  });
  it('serializes the cash-flow report', () => {
    const csv = cashFlowCsv(cashFlow([line('2026-01-05', 'asset', '503', 'debit', '500.00')], '503', 2026));
    expect(csv.split('\r\n')[0]).toBe('Месец,Постъпления,Плащания,Нетен поток,Валута');
    expect(csv).toContain('Януари,500.00,0.00,500.00,EUR');
  });
});
