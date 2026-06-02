'use client';
/** P&L — revenue, expense, net profit for a period. */
import { useQuery } from '@tanstack/react-query';
interface PnL { revenue: string; expense: string; netProfit: string; period: { from: string; to: string }; }
export function ProfitAndLossScreen({ from = '2026-04-01', to = '2026-04-30' }: { from?: string; to?: string }) {
  const { data } = useQuery({ queryKey: ['pnl', from, to], queryFn: () => fetch(`/api/reports/profit-and-loss?from=${from}&to=${to}`).then((r) => r.json() as Promise<PnL>) });
  if (!data) return <p>Loading…</p>;
  return (
    <section>
      <h1>Отчет за приходи и разходи · Profit &amp; Loss</h1>
      <table><tbody>
        <tr><td>Revenue</td><td>{data.revenue}</td></tr>
        <tr><td>Expenses</td><td>{data.expense}</td></tr>
        <tr><td><strong>Net profit</strong></td><td><strong>{data.netProfit}</strong></td></tr>
      </tbody></table>
    </section>
  );
}
