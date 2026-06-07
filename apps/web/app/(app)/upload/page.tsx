'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { uploadDocument } from '@/lib/api/upload';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { bytes } from '@/lib/format';
import { cn } from '@/lib/utils';

type Status = 'queued' | 'uploading' | 'processing' | 'done' | 'error';
interface Item { id: string; file: File; pct: number; status: Status; docId?: string; error?: string }

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xml';
let SEQ = 0;

export default function UploadPage() {
  const { activeCompany } = useAuth();
  const t = useT();
  const qc = useQueryClient();
  const [items, setItems] = React.useState<Item[]>([]);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const start = React.useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const newItems: Item[] = list.map((file) => ({ id: `f${++SEQ}`, file, pct: 0, status: 'queued' }));
    setItems((prev) => [...newItems, ...prev]);

    for (const it of newItems) {
      const update = (patch: Partial<Item>) => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
      try {
        update({ status: 'uploading' });
        const docId = await uploadDocument(it.file, (pct) => update({ pct }));
        update({ status: 'processing', pct: 100, docId });
        // brief settle so the worker advances scan→extract; the Documents list reflects live status
        setTimeout(() => update({ status: 'done' }), 1500);
      } catch (e) {
        update({ status: 'error', error: e instanceof ApiError ? e.message : (e as Error).message });
      }
    }
    qc.invalidateQueries({ queryKey: ['documents'] });
  }, [qc]);

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
                </div>
                {it.status === 'done' && it.docId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/review/${it.docId}`}>{t('upload.view')}</Link>
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
