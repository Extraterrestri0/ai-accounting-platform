'use client';
/** Review Queue — pending/approved/rejected/needs_correction, filter + assignee + pagination. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Status = 'pending' | 'approved' | 'rejected' | 'needs_correction';
interface Item { id: string; documentId: string; filename: string; status: Status; confidence?: number; isDuplicate: boolean; createdAt: string; }
interface Page { items: Item[]; total: number; page: number; pageSize: number; }
const LABEL: Record<Status, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', needs_correction: 'Needs correction' };

export function ReviewQueueScreen() {
  const [status, setStatus] = useState<Status | ''>('pending');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['review-queue', status, mine, page],
    queryFn: () => fetch('/api/reviews/queue?' + new URLSearchParams({ ...(status ? { status } : {}), assignedToMe: String(mine), page: String(page), pageSize: '25' })).then((r) => r.json() as Promise<Page>),
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section>
      <h1>Опашка за преглед · Review queue</h1>
      <div role="search">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as Status | ''); }}>
          <option value="">All</option>{(Object.keys(LABEL) as Status[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
        <label><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me</label>
      </div>
      <table>
        <thead><tr><th>Document</th><th>Status</th><th>Confidence</th><th>Flags</th><th></th></tr></thead>
        <tbody>
          {isLoading && <tr><td colSpan={5}>Loading…</td></tr>}
          {data?.items.map((it) => (
            <tr key={it.id}>
              <td>{it.filename}</td><td>{LABEL[it.status]}</td>
              <td>{it.confidence != null ? `${Math.round(it.confidence * 100)}%` : '—'}</td>
              <td>{it.isDuplicate ? 'Duplicate?' : ''}</td>
              <td><a href={`/review/${it.documentId}`}>Open</a></td>
            </tr>
          ))}
          {data && data.items.length === 0 && <tr><td colSpan={5}>Nothing to review</td></tr>}
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
