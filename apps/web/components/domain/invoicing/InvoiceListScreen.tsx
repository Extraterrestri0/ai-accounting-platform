'use client';
/** Invoice List — drafts + issued, with totals and status badges. */
import { useQuery } from '@tanstack/react-query';
interface Inv { id: string; status: 'draft' | 'issued'; invoiceNumber?: string; customerName?: string; grossTotal: string; currency: string; issueDate?: string; }
export function InvoiceListScreen() {
  const { data } = useQuery({ queryKey: ['invoices'], queryFn: () => fetch('/api/invoices').then((r) => r.json() as Promise<Inv[]>) });
  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Фактури · Invoices</h1>
        <a href="/invoices/new">New invoice</a>
      </header>
      <table>
        <thead><tr><th>Number</th><th>Customer</th><th>Status</th><th>Issue date</th><th>Total</th></tr></thead>
        <tbody>
          {data?.map((i) => (
            <tr key={i.id}>
              <td><a href={`/invoices/${i.id}`}>{i.invoiceNumber ?? '(draft)'}</a></td>
              <td>{i.customerName ?? '—'}</td>
              <td>{i.status}</td>
              <td>{i.issueDate ?? '—'}</td>
              <td>{i.grossTotal} {i.currency}</td>
            </tr>
          ))}
          {data && data.length === 0 && <tr><td colSpan={5}>No invoices yet</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
