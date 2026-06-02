'use client';
/** General Ledger — every account with its movements + running balance. */
import { useQuery } from '@tanstack/react-query';
interface Acc { accountCode: string; accountName: string; lines: { date: string; ref?: string; direction: string; amount: string; balance: string }[]; total: { debit: string; credit: string }; }
export function GeneralLedgerScreen({ from = '2026-04-01', to = '2026-04-30' }: { from?: string; to?: string }) {
  const { data } = useQuery({ queryKey: ['gl', from, to], queryFn: () => fetch(`/api/reports/general-ledger?from=${from}&to=${to}`).then((r) => r.json() as Promise<Acc[]>) });
  if (!data) return <p>Loading…</p>;
  return (
    <section>
      <h1>Главна книга · General ledger</h1>
      {data.map((a) => (
        <div key={a.accountCode}>
          <h2>{a.accountCode} {a.accountName} <small>(Dr {a.total.debit} / Cr {a.total.credit})</small></h2>
          <table><tbody>{a.lines.map((l, i) => (<tr key={i}><td>{l.date}</td><td>{l.ref}</td><td>{l.direction}</td><td>{l.amount}</td><td>{l.balance}</td></tr>))}</tbody></table>
        </div>
      ))}
    </section>
  );
}
