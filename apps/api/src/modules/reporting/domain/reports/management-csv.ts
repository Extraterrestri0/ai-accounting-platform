import type { CashFlowReport, MonthlySeries } from './models';

const MONTHS_BG = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const esc = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV for a monthly revenue/expense series (BG headers, CRLF). BOM added at the edge. */
export function monthlySeriesCsv(valueHeader: string, s: MonthlySeries): string {
  const lines = [['Месец', valueHeader, 'Валута'].join(',')];
  for (const m of s.months) lines.push([MONTHS_BG[m.month - 1], m.amount, s.currency].map(esc).join(','));
  lines.push([`Общо ${s.year}`, s.total, s.currency].map(esc).join(','));
  return lines.join('\r\n');
}

/** CSV for the cash-flow report. */
export function cashFlowCsv(c: CashFlowReport): string {
  const lines = [['Месец', 'Постъпления', 'Плащания', 'Нетен поток', 'Валута'].join(',')];
  for (const m of c.months) lines.push([MONTHS_BG[m.month - 1], m.inflow, m.outflow, m.net, c.currency].map(esc).join(','));
  lines.push([`Общо ${c.year}`, c.totalInflow, c.totalOutflow, c.netCashFlow, c.currency].map(esc).join(','));
  return lines.join('\r\n');
}
