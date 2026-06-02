'use client';
/**
 * Suggestion Review — shows the rules engine's accounting + VAT proposal: suggested account,
 * VAT treatment/code, a proposed posting, an aggregate confidence, a plain-language explanation,
 * and a duplicate-invoice warning. Consumed by the Review Queue (Task 010), where a human
 * accepts/edits/rejects. AI may suggest — it NEVER posts (Invariant 4/5).
 */
import { useQuery } from '@tanstack/react-query';

interface PostingLine { accountCode: string; side: 'debit' | 'credit'; amount: string; }
interface Suggestion {
  suggestedAccountCode?: string; confidence: number; explanation: string;
  isDuplicate: boolean; duplicateOfDocumentId?: string; suggestedPosting: PostingLine[];
  vat?: { treatment: string; rate: number; explanation: string; confidence: number };
}

export function SuggestionReviewScreen({ documentId }: { documentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['suggestion', documentId],
    queryFn: () => fetch(`/api/documents/${documentId}/suggestion`).then((r) => r.json() as Promise<Suggestion | null>),
  });
  if (isLoading) return <p>Loading suggestion…</p>;
  if (!data) return <p>No suggestion yet. <button>Generate</button></p>;
  const pct = (c: number) => `${Math.round(c * 100)}%`;
  return (
    <section>
      <h1>Предложение · Accounting suggestion</h1>
      {data.isDuplicate && <p role="alert">Possible duplicate invoice — also seen on another document.</p>}

      <dl>
        <div><dt>Suggested account</dt><dd>{data.suggestedAccountCode ?? '—'}</dd></div>
        <div><dt>VAT treatment</dt><dd>{data.vat ? `${data.vat.treatment} (${data.vat.rate}%)` : '—'}</dd></div>
        <div><dt>Confidence</dt><dd><meter min={0} max={1} value={data.confidence} /> {pct(data.confidence)}</dd></div>
      </dl>

      <p><em>{data.explanation}</em></p>

      <h2>Proposed posting (not yet booked)</h2>
      <table>
        <thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          {data.suggestedPosting.map((l, i) => (
            <tr key={i}>
              <td>{l.accountCode}</td>
              <td>{l.side === 'debit' ? l.amount : ''}</td>
              <td>{l.side === 'credit' ? l.amount : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div role="group" aria-label="review actions">
        <button>Accept</button><button>Edit</button><button>Reject</button>
      </div>
      <p><small>Suggested by the rules engine. A human must approve before anything is posted.</small></p>
    </section>
  );
}
