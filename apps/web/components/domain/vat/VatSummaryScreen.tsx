'use client';
/** VAT Summary — the СД по ЗДДС return dataset cells + payable/refundable. */
import { useQuery } from '@tanstack/react-query';
interface ReturnResult { summary: { outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number }; dataset: Record<string, string>; }
export function VatSummaryScreen({ year = 2026, month = 4 }: { year?: number; month?: number }) {
  const { data } = useQuery({ queryKey: ['vat-return', year, month], queryFn: () => fetch(`/api/vat/${year}/${month}/return`, { method: 'POST' }).then((r) => r.json() as Promise<ReturnResult>) });
  if (!data) return <p>Loading…</p>;
  return (
    <section>
      <h1>Справка-декларация по ЗДДС · VAT return — {String(month).padStart(2, '0')}/{year}</h1>
      <table>
        <tbody>
          {Object.entries(data.dataset).map(([cell, value]) => (
            <tr key={cell}><td>{cell.replace(/_/g, ' ')}</td><td>{value}</td></tr>
          ))}
        </tbody>
      </table>
      <p><strong>{data.summary.vatPayable > 0 ? `Payable: ${data.summary.vatPayable.toFixed(2)} €` : `Refundable: ${data.summary.vatRefundable.toFixed(2)} €`}</strong></p>
    </section>
  );
}
