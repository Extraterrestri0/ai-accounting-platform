import type { AccountCard, BalanceSheet, GeneralLedgerAccount, JournalReportEntry, LedgerLine, ProfitAndLoss, TrialBalance } from './models';

const toCents = (s: string): number => {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(s).trim());
  if (!m) throw new Error(`Invalid amount "${s}".`);
  return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 100 + parseInt((m[3] ?? '').padEnd(2, '0'), 10));
};
const f = (n: number): string => (n / 100).toFixed(2);

export function trialBalance(lines: LedgerLine[], period: { from: string; to: string }): TrialBalance {
  const by = new Map<string, { accountCode: string; accountName: string; type: LedgerLine['type']; debit: number; credit: number }>();
  for (const l of lines) {
    const e = by.get(l.accountCode) ?? { accountCode: l.accountCode, accountName: l.accountName, type: l.type, debit: 0, credit: 0 };
    if (l.direction === 'debit') e.debit += toCents(l.amount); else e.credit += toCents(l.amount);
    by.set(l.accountCode, e);
  }
  const rows = [...by.values()].map((e) => ({ accountCode: e.accountCode, accountName: e.accountName, type: e.type, debit: f(e.debit), credit: f(e.credit), balance: f(e.debit - e.credit) }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totDebit = [...by.values()].reduce((s, e) => s + e.debit, 0);
  const totCredit = [...by.values()].reduce((s, e) => s + e.credit, 0);
  return { rows, totals: { debit: f(totDebit), credit: f(totCredit), balanced: totDebit === totCredit }, period };
}

export function profitAndLoss(lines: LedgerLine[], period: { from: string; to: string }): ProfitAndLoss {
  let revenue = 0; let expense = 0;
  for (const l of lines) {
    if (l.type === 'revenue') revenue += l.direction === 'credit' ? toCents(l.amount) : -toCents(l.amount);
    if (l.type === 'expense') expense += l.direction === 'debit' ? toCents(l.amount) : -toCents(l.amount);
  }
  return { revenue: f(revenue), expense: f(expense), netProfit: f(revenue - expense), period };
}

export function balanceSheet(lines: LedgerLine[], asOf: string): BalanceSheet {
  let assets = 0; let liabilities = 0; let equity = 0; let revenue = 0; let expense = 0;
  for (const l of lines) {
    const signed = l.direction === 'debit' ? toCents(l.amount) : -toCents(l.amount);
    if (l.type === 'asset') assets += signed;
    else if (l.type === 'liability') liabilities += -signed;
    else if (l.type === 'equity') equity += -signed;
    else if (l.type === 'revenue') revenue += -signed;
    else if (l.type === 'expense') expense += signed;
  }
  const result = revenue - expense;
  return { assets: f(assets), liabilities: f(liabilities), equity: f(equity + result), balanced: assets === liabilities + equity + result, asOf };
}

export function accountCard(lines: LedgerLine[], accountCode: string, period: { from: string; to: string }): AccountCard {
  const filtered = lines.filter((l) => l.accountCode === accountCode);
  let bal = 0; const rows = filtered.map((l) => { bal += l.direction === 'debit' ? toCents(l.amount) : -toCents(l.amount); return { date: l.date, ref: l.ref, narrative: l.narrative, direction: l.direction, amount: f(toCents(l.amount)), balance: f(bal) }; });
  return { accountCode, accountName: filtered[0]?.accountName ?? accountCode, rows, closingBalance: f(bal), period };
}

export function generalLedger(lines: LedgerLine[]): GeneralLedgerAccount[] {
  const by = new Map<string, LedgerLine[]>();
  for (const l of lines) { const arr = by.get(l.accountCode) ?? []; arr.push(l); by.set(l.accountCode, arr); }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, ls]) => {
    let bal = 0; let debit = 0; let credit = 0;
    const rows = ls.map((l) => { const cents = toCents(l.amount); if (l.direction === 'debit') { bal += cents; debit += cents; } else { bal -= cents; credit += cents; } return { date: l.date, ref: l.ref, direction: l.direction, amount: f(cents), balance: f(bal) }; });
    return { accountCode: code, accountName: ls[0].accountName, lines: rows, total: { debit: f(debit), credit: f(credit) } };
  });
}

export function journalReport(entries: { entryNo: number; date: string; description: string; sourceType: string; lines: { accountCode: string; direction: 'debit' | 'credit'; amount: string }[] }[]): JournalReportEntry[] {
  return [...entries].sort((a, b) => a.entryNo - b.entryNo);
}
