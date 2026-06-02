import { trialBalance, profitAndLoss, balanceSheet, accountCard, generalLedger } from '../../src/modules/reporting/domain/reports/calculator';
import type { LedgerLine } from '../../src/modules/reporting/domain/reports/models';

const L: LedgerLine[] = [
  { entryId: 'e1', entryNo: 1, date: '2026-04-10', ref: 'JE1', accountCode: '411', accountName: 'Customers', type: 'asset', direction: 'debit', amount: '300.00' },
  { entryId: 'e1', entryNo: 1, date: '2026-04-10', ref: 'JE1', accountCode: '702', accountName: 'Revenue', type: 'revenue', direction: 'credit', amount: '300.00' },
  { entryId: 'e2', entryNo: 2, date: '2026-04-15', ref: 'JE2', accountCode: '602', accountName: 'Services', type: 'expense', direction: 'debit', amount: '100.00' },
  { entryId: 'e2', entryNo: 2, date: '2026-04-15', ref: 'JE2', accountCode: '401', accountName: 'Suppliers', type: 'liability', direction: 'credit', amount: '100.00' },
];
const period = { from: '2026-04-01', to: '2026-04-30' };

describe('trial balance', () => {
  it('balances (Σdebit = Σcredit)', () => {
    const tb = trialBalance(L, period);
    expect(tb.totals).toMatchObject({ debit: '400.00', credit: '400.00', balanced: true });
    expect(tb.rows.find((r) => r.accountCode === '411')!.balance).toBe('300.00');
  });
});
describe('general ledger totals', () => {
  it('groups by account with running balance + totals', () => {
    const gl = generalLedger(L);
    const a411 = gl.find((g) => g.accountCode === '411')!;
    expect(a411.total).toEqual({ debit: '300.00', credit: '0.00' });
    expect(a411.lines[0].balance).toBe('300.00');
  });
});
describe('account card totals', () => {
  it('computes a running closing balance', () => {
    expect(accountCard(L, '411', period).closingBalance).toBe('300.00');
  });
});
describe('P&L calculations', () => {
  it('revenue − expense = net profit', () => {
    expect(profitAndLoss(L, period)).toMatchObject({ revenue: '300.00', expense: '100.00', netProfit: '200.00' });
  });
});
describe('balance sheet consistency', () => {
  it('assets = liabilities + equity (incl. current result)', () => {
    const bs = balanceSheet(L, '2026-04-30');
    expect(bs.assets).toBe('300.00');
    expect(bs.balanced).toBe(true);
  });
});
