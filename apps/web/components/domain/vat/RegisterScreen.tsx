'use client';
/** Purchase / Sales register — one component, parameterized by kind. */
import { useQuery } from '@tanstack/react-query';
interface Row { documentRef?: string; treatment: string; base: number; vat: number; deductible: number; }
export function RegisterScreen({ kind, year = 2026, month = 4 }: { kind: 'purchase' | 'sales'; year?: number; month?: number }) {
  const { data } = useQuery({ queryKey: ['vat-register', kind, year, month], queryFn: () => fetch(`/api/vat/${year}/${month}/${kind}-register`).then((r) => r.json() as Promise<Row[]>) });
  const eur = (n: number) => n.toFixed(2);
  const totals = (data ?? []).reduce((a, r) => ({ base: a.base + r.base, vat: a.vat + r.vat, ded: a.ded + r.deductible }), { base: 0, vat: 0, ded: 0 });
  return (
    <section>
      <h1>{kind === 'purchase' ? 'Дневник покупки · Purchase register' : 'Дневник продажби · Sales register'}</h1>
      <table>
        <thead><tr><th>Document</th><th>Treatment</th><th>Base</th><th>VAT</th>{kind === 'purchase' && <th>Deductible</th>}</tr></thead>
        <tbody>
          {data?.map((r, i) => (
            <tr key={i}><td>{r.documentRef ?? '—'}</td><td>{r.treatment}</td><td>{eur(r.base)}</td><td>{eur(r.vat)}</td>{kind === 'purchase' && <td>{eur(r.deductible)}</td>}</tr>
          ))}
          {data && data.length === 0 && <tr><td colSpan={5}>No entries — build the registers first.</td></tr>}
        </tbody>
        {data && data.length > 0 && (
          <tfoot><tr><td>Total</td><td /><td>{eur(totals.base)}</td><td>{eur(totals.vat)}</td>{kind === 'purchase' && <td>{eur(totals.ded)}</td>}</tr></tfoot>
        )}
      </table>
    </section>
  );
}
