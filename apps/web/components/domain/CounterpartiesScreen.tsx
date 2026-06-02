'use client';
/**
 * Counterparties CRUD screen (representative master-data UI).
 * Stack: React + TypeScript + TanStack Query (chosen frontend stack — no new framework).
 * Search + kind filter + pagination; create with inline EIK/VAT validation feedback.
 * Wiring into the App Shell + design tokens happens in the frontend tasks; this component
 * is self-contained and talks to the Task 006 API via the typed client.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type Kind = 'customer' | 'supplier' | 'both';
interface Counterparty {
  id: string; kind: Kind; name: string; eik?: string; vatNumber?: string;
  countryCode: string; city?: string; isActive: boolean;
}
interface Page { items: Counterparty[]; total: number; page: number; pageSize: number; }

// typed API client (BFF proxies to apps/api; tenant/company from session — never sent by client)
const api = {
  list: (q: { search: string; kind?: Kind; page: number }) =>
    fetch(`/api/counterparties?` + new URLSearchParams({
      search: q.search, ...(q.kind ? { kind: q.kind } : {}), page: String(q.page), pageSize: '25',
    })).then((r) => r.json() as Promise<Page>),
  create: (body: Partial<Counterparty>) =>
    fetch('/api/counterparties', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).message ?? 'Failed'); return r.json(); }),
};

export function CounterpartiesScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind | undefined>();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Partial<Counterparty>>({ kind: 'supplier', countryCode: 'BG' });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['counterparties', search, kind, page],
    queryFn: () => api.list({ search, kind, page }),
  });
  const create = useMutation({
    mutationFn: api.create,
    onSuccess: () => { setError(null); setDraft({ kind: 'supplier', countryCode: 'BG' }); qc.invalidateQueries({ queryKey: ['counterparties'] }); },
    onError: (e: Error) => setError(e.message), // surfaces InvalidEik / Duplicate from the API
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section>
      <header><h1>Контрагенти / Counterparties</h1></header>
      <div role="search">
        <input placeholder="Search name / EIK / VAT" value={search}
               onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select value={kind ?? ''} onChange={(e) => { setPage(1); setKind((e.target.value || undefined) as Kind | undefined); }}>
          <option value="">All</option><option value="customer">Customers</option>
          <option value="supplier">Suppliers</option><option value="both">Both</option>
        </select>
      </div>

      {error && <p role="alert">{error}</p>}

      <table>
        <thead><tr><th>Name</th><th>EIK</th><th>VAT</th><th>Country</th><th>Kind</th><th>Status</th></tr></thead>
        <tbody>
          {isLoading && <tr><td colSpan={6}>Loading…</td></tr>}
          {data?.items.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td><td>{c.eik ?? '—'}</td><td>{c.vatNumber ?? '—'}</td>
              <td>{c.countryCode}</td><td>{c.kind}</td><td>{c.isActive ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
          {data && data.items.length === 0 && <tr><td colSpan={6}>No counterparties</td></tr>}
        </tbody>
      </table>

      <nav aria-label="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span>Page {page} / {totalPages} ({data?.total ?? 0})</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </nav>

      <form onSubmit={(e) => { e.preventDefault(); create.mutate(draft); }}>
        <h2>New counterparty</h2>
        <input required placeholder="Name" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input placeholder="EIK" value={draft.eik ?? ''} onChange={(e) => setDraft({ ...draft, eik: e.target.value })} />
        <input placeholder="VAT (e.g. BG123456789)" value={draft.vatNumber ?? ''} onChange={(e) => setDraft({ ...draft, vatNumber: e.target.value })} />
        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}>
          <option value="supplier">Supplier</option><option value="customer">Customer</option><option value="both">Both</option>
        </select>
        <button type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Create'}</button>
      </form>
    </section>
  );
}
