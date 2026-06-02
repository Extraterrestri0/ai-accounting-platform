'use client';
/**
 * Upload Center — drag & drop, multi-file, per-file progress, client + server validation.
 * Flow: client validates type/size → POST /documents/initiate → PUT bytes to uploadTarget
 * → POST /documents/:id/finalize. Stack: React + TanStack Query (chosen stack).
 * App Shell + tokens wiring lands in the frontend tasks; this is a representative screen.
 */
import { useCallback, useState } from 'react';

const ALLOWED = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'xml'];
const MAX_BYTES = 25 * 1024 * 1024;
type Phase = 'queued' | 'uploading' | 'scanning' | 'ready' | 'error';
interface Item { id: string; name: string; size: number; phase: Phase; pct: number; error?: string; }

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function UploadCenterScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const patch = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const clientValidate = (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED.includes(ext)) return `Unsupported type .${ext} (PDF, JPG, PNG, TIFF, XML only)`;
    if (f.size > MAX_BYTES) return `Too large (${(f.size / 1048576).toFixed(1)} MB > 25 MB)`;
    if (f.size === 0) return 'Empty file';
    return null;
  };

  const uploadOne = useCallback(async (f: File, idx: number) => {
    const err = clientValidate(f);
    if (err) { patch(idx, { phase: 'error', error: err }); return; }
    try {
      patch(idx, { phase: 'uploading', pct: 10 });
      const init = await fetch('/api/documents/initiate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: f.name, mimeType: f.type || 'application/octet-stream', sizeBytes: f.size }),
      });
      if (!init.ok) throw new Error((await init.json()).message ?? 'Initiate failed');
      const { document, uploadTarget } = await init.json();
      patch(idx, { pct: 40 });
      await fetch(uploadTarget.url, { method: uploadTarget.method, headers: uploadTarget.headers, body: f });
      patch(idx, { pct: 75 });
      const fin = await fetch(`/api/documents/${document.id}/finalize`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ checksumSha256: await sha256(f) }),
      });
      if (!fin.ok) throw new Error((await fin.json()).message ?? 'Finalize failed'); // e.g. file-type mismatch
      patch(idx, { phase: 'scanning', pct: 100 }); // server enqueues malware scan → status polled in Archive
    } catch (e) {
      patch(idx, { phase: 'error', error: (e as Error).message });
    }
  }, []);

  const onFiles = useCallback((files: FileList) => {
    const base = items.length;
    const next: Item[] = [...files].map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, phase: 'queued', pct: 0 }));
    setItems((xs) => [...xs, ...next]);
    [...files].forEach((f, k) => uploadOne(f, base + k));
  }, [items.length, uploadOne]);

  return (
    <section>
      <h1>Качване на документи · Upload Center</h1>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
        data-dragging={dragging}
        role="button" aria-label="Drop files or click to browse"
      >
        <p>Drag &amp; drop files here, or</p>
        <label>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.xml" hidden
                 onChange={(e) => e.target.files && onFiles(e.target.files)} />
          Browse…
        </label>
        <small>PDF, JPG, PNG, TIFF, XML · up to 25 MB each</small>
      </div>

      <ul aria-label="upload queue">
        {items.map((it) => (
          <li key={it.id} data-phase={it.phase}>
            <span>{it.name}</span>
            <span>{(it.size / 1024).toFixed(0)} KB</span>
            {it.phase === 'error'
              ? <span role="alert">{it.error}</span>
              : <progress max={100} value={it.pct} />}
            <span>{it.phase}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
