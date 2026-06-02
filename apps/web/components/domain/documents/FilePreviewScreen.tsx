'use client';
/** File Preview — fetches a short-lived signed URL and renders in a sandboxed frame. */
import { useQuery } from '@tanstack/react-query';

export function FilePreviewScreen({ documentId }: { documentId: string }) {
  const { data: doc } = useQuery({ queryKey: ['document', documentId], queryFn: () => fetch(`/api/documents/${documentId}`).then((r) => r.json()) });
  const { data: dl } = useQuery({
    queryKey: ['document-url', documentId],
    queryFn: () => fetch(`/api/documents/${documentId}/download-url`).then((r) => r.json() as Promise<{ url: string }>),
    enabled: doc?.status === 'ready',
    refetchInterval: 4 * 60 * 1000, // refresh before the 5-min signed URL expires
  });
  if (!doc) return <p>Loading…</p>;
  if (doc.status === 'quarantined') return <p role="alert">This document was quarantined by the malware scan and cannot be viewed.</p>;
  if (doc.status !== 'ready') return <p>Document is {doc.status}… preview available once ready.</p>;
  const isPdf = doc.metadata?.detectedType === 'pdf';
  return (
    <section>
      <h1>{doc.originalFilename}</h1>
      {dl && (isPdf
        ? <iframe title={doc.originalFilename} src={dl.url} sandbox="allow-same-origin" style={{ width: '100%', height: 600 }} />
        : (
          // eslint-disable-next-line @next/next/no-img-element -- representative preview; static export, next/image unavailable
          <img alt={doc.originalFilename} src={dl.url} style={{ maxWidth: '100%' }} />
        ))}
    </section>
  );
}
