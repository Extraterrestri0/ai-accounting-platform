'use client';
/**
 * Review Detail — original document preview, extracted fields + confidence + validation,
 * accounting & VAT suggestions, duplicate warnings, and human actions (approve/reject/edit/
 * comment/assign). Only humans can decide; the API + DB both enforce this (Invariant 4/5).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Detail {
  package: { id: string; status: string; assignedReviewerId?: string };
  documentDownloadUrl?: string;
  extraction: { overallConfidence: number; fields: { key: string; valueText?: string; confidence: number; validationStatus: string }[] };
  suggestion: { suggestedAccountCode?: string; confidence: number; explanation: string; isDuplicate: boolean; vat?: { treatment: string; rate: number } } | null;
  comments: { id: string; authorId: string; body: string; createdAt: string }[];
}

export function ReviewDetailScreen({ documentId }: { documentId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['review-detail', documentId], queryFn: () => fetch(`/api/reviews/documents/${documentId}`).then((r) => r.json() as Promise<Detail>) });
  const act = (verb: string, body?: unknown) => fetch(`/api/reviews/${data!.package.id}/${verb}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(() => qc.invalidateQueries({ queryKey: ['review-detail', documentId] }));
  const approve = useMutation({ mutationFn: () => act('approve') });
  const reject = useMutation({ mutationFn: () => act('reject', { reason: 'Rejected by reviewer' }) });
  if (!data) return <p>Loading…</p>;
  const pct = (c: number) => `${Math.round(c * 100)}%`;
  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <h2>Document</h2>
        {data.documentDownloadUrl ? <iframe title="document" src={data.documentDownloadUrl} sandbox="allow-same-origin" style={{ width: '100%', height: 480 }} /> : <p>Preview unavailable</p>}
      </div>
      <div>
        <h1>Review · {data.package.status}</h1>
        {data.suggestion?.isDuplicate && <p role="alert">Possible duplicate invoice.</p>}
        <h2>Extracted fields</h2>
        <table><tbody>
          {data.extraction.fields.map((f) => (
            <tr key={f.key}><td>{f.key}</td><td>{f.valueText ?? '—'}</td><td>{pct(f.confidence)}</td><td>{f.validationStatus}</td></tr>
          ))}
        </tbody></table>
        {data.suggestion && (
          <>
            <h2>Suggestion</h2>
            <p>Account <strong>{data.suggestion.suggestedAccountCode}</strong> · VAT {data.suggestion.vat ? `${data.suggestion.vat.treatment} ${data.suggestion.vat.rate}%` : '—'} · {pct(data.suggestion.confidence)}</p>
            <p><em>{data.suggestion.explanation}</em></p>
          </>
        )}
        <div role="group" aria-label="actions">
          <button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</button>
          <button onClick={() => reject.mutate()}>Reject</button>
          <button>Edit</button><button>Request correction</button>
        </div>
      </div>
    </section>
  );
}
