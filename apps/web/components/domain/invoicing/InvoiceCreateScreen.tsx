'use client';
/** Invoice Create — customer + lines (qty, unit price, VAT %); live net/VAT/gross totals. */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
interface LineForm { description: string; quantity: string; unitPrice: string; vatRate: string; }
const cents = (s: string) => Math.round(Number(s) * 100) || 0;
export function InvoiceCreateScreen() {
  const [customerName, setCustomerName] = useState('');
  const [lines, setLines] = useState<LineForm[]>([{ description: '', quantity: '1', unitPrice: '0.00', vatRate: '20' }]);
  const create = useMutation({ mutationFn: (body: unknown) => fetch('/api/invoices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()) });
  const setLine = (i: number, patch: Partial<LineForm>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const net = lines.reduce((a, l) => a + Math.round(Number(l.quantity) * cents(l.unitPrice)), 0);
  const vat = lines.reduce((a, l) => a + Math.round(Math.round(Number(l.quantity) * cents(l.unitPrice)) * Number(l.vatRate) / 100), 0);
  const f = (c: number) => (c / 100).toFixed(2);
  return (
    <section>
      <h1>Нова фактура · New invoice</h1>
      <label>Customer <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>VAT %</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
              <td><input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} style={{ width: 60 }} /></td>
              <td><input value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} style={{ width: 90 }} /></td>
              <td><input value={l.vatRate} onChange={(e) => setLine(i, { vatRate: e.target.value })} style={{ width: 60 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setLines((ls) => [...ls, { description: '', quantity: '1', unitPrice: '0.00', vatRate: '20' }])}>Add line</button>
      <p>Net {f(net)} · VAT {f(vat)} · Gross {f(net + vat)} EUR</p>
      <button onClick={() => create.mutate({ customerName, lines })} disabled={create.isPending}>Save draft</button>
    </section>
  );
}
