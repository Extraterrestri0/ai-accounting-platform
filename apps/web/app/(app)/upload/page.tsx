'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { UploadCloud, FileText, Loader2, ArrowRight, AlertTriangle, RotateCw, FolderOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { uploadDocument } from '@/lib/api/upload';
import { ApiError } from '@/lib/api/client';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { Notice } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT, useLang } from '@/lib/i18n';
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
  const { lang } = useLang();
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

  const openPicker = () => inputRef.current?.click();
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('upload.title')}
        description={t('upload.subtitle')}
        actions={<Button variant="outline" asChild><Link href="/documents">{t('upload.toDocs')} <ArrowRight /></Link></Button>}
      />

      {pipelineDown && (
        <Notice tone="warning" icon={AlertTriangle}>{t('pipeline.down')}</Notice>
      )}

      {/* Dropzone */}
      <Card>
        <CardContent className="p-3">
          <div
            role="button"
            tabIndex={0}
            aria-label={t('upload.drop')}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={openPicker}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-md border border-dashed px-6 py-16 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              drag ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-2/60 hover:border-brand/50 hover:bg-surface-2',
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-brand ring-1 ring-border">
              <UploadCloud className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div className="space-y-1">
              <p className="text-[15px] font-semibold text-foreground">{lang === 'bg' ? 'Пуснете файлове тук' : 'Drop files here'}</p>
              <p className="text-[13px] text-muted-foreground">{t('upload.hint')}</p>
            </div>
            <Button type="button" variant="outline" onClick={(e) => { e.stopPropagation(); openPicker(); }}>
              <FolderOpen /> {lang === 'bg' ? 'Изберете файлове' : 'Choose files'}
            </Button>
            {!activeCompany && <p className="text-xs font-medium text-destructive">{t('upload.pickCompany')}</p>}
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
          <CardHeader className="flex-row items-end justify-between space-y-0 pb-3">
            <div>
              <CardTitle>{lang === 'bg' ? 'Качени файлове' : 'Uploaded files'}</CardTitle>
              <CardDescription className="mt-0.5">
                <span className="tabular-nums">{doneCount}</span> / <span className="tabular-nums">{items.length}</span> {lang === 'bg' ? 'обработени' : 'processed'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[13px] font-medium text-foreground">{it.file.name}</p>
                    <StatusPill it={it} />
                  </div>
                  <p className="t-caption tabular-nums">{bytes(it.file.size)}</p>
                  {(it.status === 'uploading' || it.status === 'processing' || it.status === 'done') && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                      aria-valuenow={it.status === 'uploading' ? it.pct : 100}>
                      <div
                        className={cn('h-full rounded-full transition-[width]', it.status === 'done' ? 'bg-success' : 'bg-brand')}
                        style={{ width: `${it.status === 'processing' || it.status === 'done' ? 100 : it.pct}%` }}
                      />
                    </div>
                  )}
                  {it.error && <p className="mt-1 text-xs text-destructive">{it.error}</p>}
                  {it.status === 'stalled' && <p className="mt-1 text-xs text-warning">{t('pipeline.delayed')}</p>}
                </div>
                {it.status === 'done' && it.docId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/review/${it.docId}`}>{t('upload.view')} <ArrowRight /></Link>
                  </Button>
                )}
                {(it.status === 'stalled' || it.status === 'error') && (
                  <Button size="sm" variant="outline" onClick={() => retry(it)}>
                    <RotateCw /> {t('pipeline.retry')}
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
  const map: Record<Status, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'destructive'; spin: boolean }> = {
    queued: { label: t('upload.stQueued'), variant: 'neutral', spin: false },
    uploading: { label: t('upload.stUploading', { pct: it.pct }), variant: 'info', spin: true },
    processing: { label: t('upload.stProcessing'), variant: 'warning', spin: true },
    done: { label: t('upload.stDone'), variant: 'success', spin: false },
    stalled: { label: t('upload.stStalled'), variant: 'warning', spin: false },
    error: { label: t('upload.stError'), variant: 'destructive', spin: false },
  };
  const m = map[it.status];
  return (
    <Badge variant={m.variant} dot={!m.spin} className="shrink-0">
      {m.spin && <Loader2 className="h-3 w-3 animate-spin" />}
      {m.label}
    </Badge>
  );
}
