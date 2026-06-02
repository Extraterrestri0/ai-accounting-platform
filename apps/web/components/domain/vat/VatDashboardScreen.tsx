'use client';
/** VAT Dashboard — period summary (output / deductible / payable / refundable) + build/generate actions. */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
interface Summary { outputVat: number; deductibleVat: number; vatPayable: number; vatRefundable: number; }
export function VatDashboardScreen({ year = 2026, month = 4 }: { year?: number; month?: number }) {
  const qc = useQueryClient();
  const [y] = useState(year); const [m] = useState(month);
  const { data } = useQuery({ queryKey: ['vat-summary', y, m], queryFn: () => fetch(`/api/vat/${y}/${m}/summary`).then((r) => r.json() as Promise<Summary>) });
  const build = useMutation({ mutationFn: () => fetch(`/api/vat/${y}/${m}/build`, { method: 'POST' }).then((r) => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ['vat-summary', y, m] }) });
  const eur = (n?: number) => (n ?? 0).toFixed(2) + ' €';
  return (
    <section>
      <h1>ДДС табло · VAT dashboard — {String(m).padStart(2, '0')}/{y}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <div><div>Output VAT (sales)</div><div style={{ fontSize: 22 }}>{eur(data?.outputVat)}</div></div>
        <div><div>Deductible VAT</div><div style={{ fontSize: 22 }}>{eur(data?.deductibleVat)}</div></div>
        <div><div>VAT payable</div><div style={{ fontSize: 22 }}>{eur(data?.vatPayable)}</div></div>
        <div><div>VAT refundable</div><div style={{ fontSize: 22 }}>{eur(data?.vatRefundable)}</div></div>
      </div>
      <button onClick={() => build.mutate()} disabled={build.isPending}>{build.isPending ? 'Building…' : 'Build registers'}</button>
      <a href={`/vat/${y}/${m}/return`}>Generate VAT return</a>
    </section>
  );
}
