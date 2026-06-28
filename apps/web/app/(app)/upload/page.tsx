'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2, ArrowRight, X, AlertTriangle, RotateCw } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { uploadDocument } from '@/lib/api/upload';
import { ApiError } from '@/lib/api/client';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { bytes } from '@/lib/format';
import { cn } from '@/lib/utils';

type Status = 'queued' | 'uploading' | 'processing' | 'done' | 'stalled' | 'error';
interface Item { id: string; file: File; pct: number; status: Status; docId?: string; error?: string }

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xml';
let SEQ = 0;

// Bounded wait for the scan→extract pipeline to advance the doc past 'scanning'. If it never
// does (worker/Redis down), we stop the spinner and show an actionable 'stalled' state.
const POLL_MS = 1500;
const MAX_POLLS = 14; // ~21s
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DONE_STATES = new Set(['ready', 'ready_for_review', 'clean', 'extracted', 'reviewing', 'reviewed', 'approved', 'posted']);

export default function UploadPage() {
  const { activeCompany } = useAuth();
  const t = useT();
  const qc = useQueryClient();
  const [items, setItems] = React.useState<Item[]>([]);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Pipeline health — proactively warn that uploads will stall when scan/extract is down.
  const healthQ = useQuery({ queryKey: ['health'], queryFn: () => Endpoints.health().catch(() => null), refetchInterval: 30000, staleTime: 20000 });
  const dp = healthQ.data?.checks?.docPipeline;
  const pipelineDown = dp ? dp.status === 'down' || dp.status === 'degraded' : false;

  const setItem = React.useCallback((id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))), []);

  // Poll the document until the pipeline advances it, or give up with an actionable state.
  const settle = React.useCallback(async (id: string, docId: string) => {
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_MS);
      let status: string | undefined;
      try { status = (await Endpoints.document(docId)).status; } catch { continue; }
      if (!status) continue;
      if (DONE_STATES.has(status)) { setItem(id, { status: 'done' }); qc.invalidateQueries({ queryKey: ['documents'] }); return; }
      if (status === 'failed') { setItem(id, { status: 'error', error: t('pipeline.failed') }); return; }
      if (status === 'quarantined') { setItem(id, { status: 'error', error: t('pipeline.quarantined') }); return; }
      // still 'scanning'/'pending_upload' — keep waiting
    }
    setItem(id, { status: 'stalled' }); // pipeline never advanced within the budget
  }, [qc, setItem, t]);

  const start = React.useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const newItems: Item[] = list.map((file) => ({ id: `f${++SEQ}`, file, pct: 0, status: 'queued' }));
    setItems((prev) => [...newItems, ...prev]);

    for (const it of newItems) {
      try {
        setItem(it.id, { status: 'uploading' });
        const docId = await uploadDocument(it.file, (pct) => setItem(it.id, { pct }));
        setItem(it.id, { status: 'processing', pct: 100, docId });
        void settle(it.id, docId);
      } catch (e) {
        setItem(it.id, { status: 'error', error: e instanceof ApiError ? e.message : (e as Error).message });
      }
    }
    qc.invalidateQueries({ queryKey: ['documents'] });
  }, [qc, setItem, settle]);

  // Retry a stalled/failed item: re-enqueue the scan when we have a doc, else re-upload the file.
  const retry = React.useCallback((it: Item) => {
    if (it.docId) {
      setItem(it.id, { status: 'processing', error: undefined });
      Endpoints.rescanDocument(it.docId)
        .then(() => settle(it.id, it.docId!))
        .catch((e) => setItem(it.id, { status: 'error', error: e instanceof ApiError ? e.message : (e as Error).message }));
    } else {
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      void start([it.file]);
    }
  }, [setItem, settle, start]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) start(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('upload.title')}
        description={t('upload.subtitle')}
        actions={<Button variant="outline" asChild><Link href="/documents">{t('upload.toDocs')} <ArrowRight className="h-4 w-4" /></Link></Button>}
      />

      {pipelineDown && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('pipeline.down')}</span>
        </div>
      )}

      {/* Dropzone */}
      <Card>
        <CardContent className="p-0">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors',
              drag ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40 hover:bg-secondary/40',
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <UploadCloud className="h-7 w-7" />
            </span>
            <div>
              <p className="text-base font-medium text-foreground">{t('upload.drop')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('upload.hint')}</p>
            </div>
            {!activeCompany && <p className="text-xs text-destructive">{t('upload.pickCompany')}</p>}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) start(e.target.files); e.target.value = ''; }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upload list */}
      {items.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{it.file.name}</p>
                    <StatusPill it={it} />
                  </div>
                  <p className="text-xs text-muted-foreground">{bytes(it.file.size)}</p>
                  {(it.status === 'uploading' || it.status === 'processing' || it.status === 'done') && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn('h-full rounded-full transition-all', it.status === 'done' ? 'bg-success' : 'bg-primary')}
                        style={{ width: `${it.status === 'processing' || it.status === 'done' ? 100 : it.pct}%` }}
                      />
                    </div>
                  )}
                  {it.error && <p className="mt-1 text-xs text-destructive">{it.error}</p>}
                  {it.status === 'stalled' && <p className="mt-1 text-xs text-warning">{t('pipeline.delayed')}</p>}
                </div>
                {it.status === 'done' && it.docId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/review/${it.docId}`}>{t('upload.view')}</Link>
                  </Button>
                )}
                {(it.status === 'stalled' || it.status === 'error') && (
                  <Button size="sm" variant="outline" onClick={() => retry(it)}>
                    <RotateCw className="h-4 w-4" /> {t('pipeline.retry')}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusPill({ it }: { it: Item }) {
  const t = useT();
  const map = {
    queued: { label: t('upload.stQueued'), cls: 'text-muted-foreground', icon: Loader2, spin: false },
    uploading: { label: t('upload.stUploading', { pct: it.pct }), cls: 'text-primary', icon: Loader2, spin: true },
    processing: { label: t('upload.stProcessing'), cls: 'text-warning', icon: Loader2, spin: true },
    done: { label: t('upload.stDone'), cls: 'text-success', icon: CheckCircle2, spin: false },
    stalled: { label: t('upload.stStalled'), cls: 'text-warning', icon: AlertTriangle, spin: false },
    error: { label: t('upload.stError'), cls: 'text-destructive', icon: XCircle, spin: false },
  } as const;
  const m = map[it.status];
  const Icon = m.icon;
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-medium', m.cls)}>
      <Icon className={cn('h-3.5 w-3.5', m.spin && 'animate-spin')} />
      {m.label}
    </span>
  );
}
