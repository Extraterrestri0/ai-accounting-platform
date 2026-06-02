'use client';
/** Document Archive — search + status/type filters + pagination + status tracking + preview link. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Status = 'pending_upload' | 'uploaded' | 'scanning' | 'ready' | 'quarantined' | 'failed';
interface Doc { id: string; originalFilename: string; mimeType: string; status: Status; createdAt: string; metadata?: { detectedType?: string; scanStatus?: string }; }
interface Page { items: Doc[]; total: number; page: number; pageSize: number; }

const statusLabel: Record<Status, string> = {
  pending_upload: 'Pending', uploaded: 'Uploaded', scanning: 'Scanning', ready: 'Ready', quarantined: 'Quarantined', failed: 'Failed',
};

export function DocumentArchiveScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', search, status, page],
    queryFn: () => fetch('/api/documents?' + new URLSearchParams({
      search, ...(status ? { status } : {}), page: String(page), pageSize: '25',
    })).then((r) => r.json() as Promise<Page>),
    refetchInterval: (q) => (q.state.data?.items.some((d) => d.status === 'scanning') ? 3000 : false), // poll while scanning
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section>
      <h1>Архив на документи · Document Archive</h1>
      <div role="search">
        <input placeholder="Search filename" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as Status | ''); }}>
          <option value="">All statuses</option>
          {(Object.keys(statusLabel) as Status[]).map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>File</th><th>Type</th><th>Status</th><th>Uploaded</th><th></th></tr></thead>
        <tbody>
          {isLoading && <tr><td colSpan={5}>Loading…</td></tr>}
          {data?.items.map((d) => (
            <tr key={d.id}>
              <td>{d.originalFilename}</td>
              <td>{d.metadata?.detectedType ?? d.mimeType}</td>
              <td>{statusLabel[d.status]}</td>
              <td>{new Date(d.createdAt).toLocaleDateString()}</td>
              <td>{d.status === 'ready' && <a href={`/documents/${d.id}`}>Preview</a>}</td>
            </tr>
          ))}
          {data && data.items.length === 0 && <tr><td colSpan={5}>No documents</td></tr>}
        </tbody>
      </table>
      <nav aria-label="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span>Page {page} / {totalPages} ({data?.total ?? 0})</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </nav>
    </section>
  );
}
