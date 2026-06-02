'use client';
/** Invoice Detail — status, totals, VAT breakdown, issue + email actions, email status. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
interface Line { description: string; quantity: string; unitPrice: string; vatRate: string; netAmount: string; vatAmount: string; grossAmount: string; }
interface Inv { id: string; status: 'draft' | 'issued'; invoiceNumber?: string; customerName?: string; netTotal: string; vatTotal: string; grossTotal: string; currency: string; journalEntryId?: string; lines: Line[]; }
interface Delivery { id: string; toEmail: string; status: string; }
export function InvoiceDetailScreen({ invoiceId }: { invoiceId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => fetch(`/api/invoices/${invoiceId}`).then((r) => r.json() as Promise<Inv>) });
  const { data: emails } = useQuery({ queryKey: ['invoice-emails', invoiceId], queryFn: () => fetch(`/api/invoices/${invoiceId}/email`).then((r) => r.json() as Promise<Delivery[]>) });
  const issue = useMutation({ mutationFn: () => fetch(`/api/invoices/${invoiceId}/issue`, { method: 'POST' }).then((r) => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', invoiceId] }) });
  const send = useMutation({ mutationFn: (to: string) => fetch(`/api/invoices/${invoiceId}/email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toEmail: to }) }).then((r) => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-emails', invoiceId] }) });
  if (!data) return <p>Loading…</p>;
  return (
    <section>
      <h1>{data.invoiceNumber ?? 'Draft invoice'} · {data.status}</h1>
      <p>Customer: {data.customerName} · Net {data.netTotal} · VAT {data.vatTotal} · Gross {data.grossTotal} {data.currency}</p>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>VAT %</th><th>Net</th><th>VAT</th><th>Gross</th></tr></thead>
        <tbody>{data.lines.map((l, i) => (<tr key={i}><td>{l.description}</td><td>{l.quantity}</td><td>{l.unitPrice}</td><td>{l.vatRate}</td><td>{l.netAmount}</td><td>{l.vatAmount}</td><td>{l.grossAmount}</td></tr>))}</tbody>
      </table>
      {data.status === 'draft' && <button onClick={() => issue.mutate()} disabled={issue.isPending}>{issue.isPending ? 'Issuing…' : 'Issue invoice'}</button>}
      {data.status === 'issued' && (
        <div>
          <p>Posted entry: <code>{data.journalEntryId ?? 'pending'}</code></p>
          <button onClick={() => send.mutate('customer@example.com')}>Send by email</button>
          <ul>{emails?.map((e) => (<li key={e.id}>{e.toEmail} — {e.status}</li>))}</ul>
        </div>
      )}
      <p><small>Issuing assigns a gapless number, posts to the ledger, and feeds the sales VAT register. Issued invoices are immutable; only a human can issue, post, or send.</small></p>
    </section>
  );
}
