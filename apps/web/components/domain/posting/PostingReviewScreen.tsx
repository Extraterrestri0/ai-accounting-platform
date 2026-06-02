'use client';
/**
 * Posting — turns an APPROVED review into an immutable journal entry. Shows the approved posting,
 * a "Post to ledger" action (human-only; AI cannot post), the resulting entry number + lines,
 * and a reversal action (the ledger never edits/deletes — corrections are reversing entries).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Line { accountCode?: string; accountId?: string; side?: 'debit' | 'credit'; direction?: 'debit' | 'credit'; amount: string; }
interface Posting { request: { id: string; status: string; kind: string; lines?: Line[] }; journalEntryId?: string; }

export function PostingReviewScreen({ packageId, approvedStatus, approvedPosting }: { packageId: string; approvedStatus: string; approvedPosting?: Line[] }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['posting', packageId], queryFn: () => fetch(`/api/reviews/${packageId}/posting`).then((r) => (r.ok ? r.json() : null) as Promise<Posting | null>) });
  const post = useMutation({ mutationFn: () => fetch(`/api/reviews/${packageId}/post`, { method: 'POST' }).then((r) => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ['posting', packageId] }) });
  const reverse = useMutation({ mutationFn: (entryId: string) => fetch(`/api/ledger/entries/${entryId}/reverse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Reversed by user' }) }).then((r) => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ['posting', packageId] }) });

  const posted = data?.request.status === 'posted' || !!data?.journalEntryId;
  const lines = data?.request.lines ?? approvedPosting ?? [];
  const code = (l: Line) => l.accountCode ?? l.accountId ?? '';
  const dir = (l: Line) => l.side ?? l.direction;
  return (
    <section>
      <h1>Осчетоводяване · Post to ledger</h1>
      <p>Review status: <strong>{approvedStatus}</strong>{posted && <> · Entry posted</>}</p>

      <h2>{posted ? 'Journal entry' : 'Approved posting (proposed)'}</h2>
      <table>
        <thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}><td>{code(l)}</td><td>{dir(l) === 'debit' ? l.amount : ''}</td><td>{dir(l) === 'credit' ? l.amount : ''}</td></tr>
          ))}
        </tbody>
      </table>

      {!posted && (
        <button onClick={() => post.mutate()} disabled={approvedStatus !== 'approved' || post.isPending}>
          {post.isPending ? 'Posting…' : 'Post to ledger'}
        </button>
      )}
      {posted && data?.journalEntryId && (
        <div>
          <p>Posted as journal entry <code>{data.journalEntryId}</code>.</p>
          <button onClick={() => reverse.mutate(data.journalEntryId!)}>Reverse entry</button>
        </div>
      )}
      <p><small>Only a human can post. The ledger is immutable — corrections are reversing entries, never edits or deletes.</small></p>
    </section>
  );
}
