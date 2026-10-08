/**
 * Deterministic comparison helpers (ADR-001 §2): month-over-month P&L deltas and
 * expense breakdowns. Pure functions over report-service outputs — the assistant
 * narrates these numbers; it never computes its own.
 */

export interface PnlLike { revenue: string; expense: string; netProfit: string; }
export interface TbRowLike { accountCode: string; accountName: string; type: string; debit: string; credit: string; balance: string; }

export interface PnlDelta {
  revenue: { current: number; previous: number; change: number };
  expense: { current: number; previous: number; change: number };
  netProfit: { current: number; previous: number; change: number };
  /** Primary driver of the profit change, by absolute magnitude. */
  driver: 'revenue' | 'expense' | 'both' | 'none';
}

const num = (s: string | number): number => {
  const n = typeof s === 'number' ? s : parseFloat(String(s).replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const money = (n: number): string => n.toFixed(2);

export function pnlDelta(current: PnlLike, previous: PnlLike): PnlDelta {
  const rev = { current: num(current.revenue), previous: num(previous.revenue), change: 0 };
  const exp = { current: num(current.expense), previous: num(previous.expense), change: 0 };
  const net = { current: num(current.netProfit), previous: num(previous.netProfit), change: 0 };
  rev.change = +(rev.current - rev.previous).toFixed(2);
  exp.change = +(exp.current - exp.previous).toFixed(2);
  net.change = +(net.current - net.previous).toFixed(2);
  const revMag = Math.abs(rev.change); const expMag = Math.abs(exp.change);
  const driver = revMag === 0 && expMag === 0 ? 'none'
    : revMag > expMag * 1.5 ? 'revenue'
    : expMag > revMag * 1.5 ? 'expense'
    : 'both';
  return { revenue: rev, expense: exp, netProfit: net, driver };
}

export interface ExpenseRow { accountCode: string; accountName: string; amount: number; }

/** Top expense accounts from a trial balance (expense-type rows, by debit balance). */
export function topExpenses(rows: TbRowLike[], limit = 5): ExpenseRow[] {
  return rows
    .filter((r) => r.type === 'expense')
    .map((r) => ({ accountCode: r.accountCode, accountName: r.accountName, amount: Math.abs(num(r.balance)) || num(r.debit) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export interface RegisterRowLike { journalEntryId: string; kind: string; base: number; vat: number; deductible: number; documentRef?: string; }

/** Largest VAT drivers from the period registers (sales add output VAT; purchases add credit). */
export function vatDrivers(sales: RegisterRowLike[], purchases: RegisterRowLike[], limit = 3): {
  topOutput: RegisterRowLike[]; topDeductible: RegisterRowLike[];
} {
  const topOutput = [...sales].filter((r) => r.vat > 0).sort((a, b) => b.vat - a.vat).slice(0, limit);
  const topDeductible = [...purchases].filter((r) => r.deductible > 0).sort((a, b) => b.deductible - a.deductible).slice(0, limit);
  return { topOutput, topDeductible };
}
