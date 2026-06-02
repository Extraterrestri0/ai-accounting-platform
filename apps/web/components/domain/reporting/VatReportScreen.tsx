'use client';
/** VAT Report — output / deductible / payable / refundable for a month (from the tax context). */
import { useQuery } from '@tanstack/react-query';
interface Vat { outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number; }
export function VatReportScreen({ year = 2026, month = 4 }: { year?: number; month?: number }) {
  const { data } = useQuery({ queryKey: ['vat-report', year, month], queryFn: () => fetch(`/api/reports/vat?year=${year}&month=${month}`).then((r) => r.json() as Promise<Vat>) });
  if (!data) return <p>Loading…</p>;
  const eur = (n: number) => n.toFixed(2) + ' €';
  return (
    <section>
      <h1>ДДС отчет · VAT report — {String(month).padStart(2, '0')}/{year}</h1>
      <table><tbody>
        <tr><td>Output VAT</td><td>{eur(data.outputVat)}</td></tr>
        <tr><td>Deductible VAT</td><td>{eur(data.deductibleVat)}</td></tr>
        <tr><td><strong>VAT payable</strong></td><td><strong>{eur(data.vatPayable)}</strong></td></tr>
        <tr><td>VAT refundable</td><td>{eur(data.vatRefundable)}</td></tr>
      </tbody></table>
    </section>
  );
}
