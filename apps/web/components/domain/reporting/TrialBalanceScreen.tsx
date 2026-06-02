'use client';
/** Trial Balance — per-account debit/credit/balance with a balanced check; drill-down to account card. */
import { useQuery } from '@tanstack/react-query';
interface Row { accountCode: string; accountName: string; debit: string; credit: string; balance: string; }
interface TB { rows: Row[]; totals: { debit: string; credit: string; balanced: boolean }; period: { from: string; to: string }; }
export function TrialBalanceScreen({ from = '2026-04-01', to = '2026-04-30' }: { from?: string; to?: string }) {
  const { data } = useQuery({ queryKey: ['tb', from, to], queryFn: () => fetch(`/api/reports/trial-balance?from=${from}&to=${to}`).then((r) => r.json() as Promise<TB>) });
  if (!data) return <p>Loading…</p>;
  return (
    <section>
      <h1>Оборотна ведомост · Trial balance</h1>
      <table>
        <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
        <tbody>{data.rows.map((r) => (<tr key={r.accountCode}><td><a href={`/reports/account-card?account=${r.accountCode}`}>{r.accountCode} {r.accountName}</a></td><td>{r.debit}</td><td>{r.credit}</td><td>{r.balance}</td></tr>))}</tbody>
        <tfoot><tr><td>Total</td><td>{data.totals.debit}</td><td>{data.totals.credit}</td><td>{data.totals.balanced ? 'Balanced ✓' : 'Out of balance!'}</td></tr></tfoot>
      </table>
    </section>
  );
}
