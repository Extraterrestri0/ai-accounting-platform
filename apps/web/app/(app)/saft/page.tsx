'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileCode2, Play, ShieldCheck, Loader2, Download, Eye, XCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { dateTimeBG } from '@/lib/format';
import type { SaftDataset, SaftValidationSummary, SaftValidationIssue } from '@/lib/api/types';

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const selectCls = 'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const NOW = { y: 2026, m: 6 };

export default function SaftPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [year, setYear] = React.useState(NOW.y);
  const [month, setMonth] = React.useState(NOW.m);
  const [validation, setValidation] = React.useState<SaftValidationSummary | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const exportsQ = useQuery({ queryKey: ['saft', 'exports', companyId], queryFn: () => Endpoints.saftExports({ pageSize: 50 }), enabled: !!companyId });

  const validate = useMutation({
    mutationFn: () => Endpoints.saftValidate(year, month),
    onSuccess: (s) => { setValidation(s); toast.success('Валидацията завърши'); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const generate = useMutation({
    mutationFn: () => Endpoints.generateSaftExport(year, month),
    onSuccess: (r) => {
      setValidation(r.validationSummary ?? null);
      toast[r.status === 'failed' ? 'error' : 'success'](r.status === 'failed' ? 'Генерирането е неуспешно' : 'SAF-T наборът е генериран');
      qc.invalidateQueries({ queryKey: ['saft'] });
    },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const busy = validate.isPending || generate.isPending;
  const exports = exportsQ.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="SAF-T (готов набор от данни)"
        description="Генериране на нормализиран SAF-T набор (Header, Master Files, GL, изходни документи) от съществуващите данни. v1 не създава финален XML."
        actions={
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>{[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}</select>
            <Button variant="outline" onClick={() => validate.mutate()} disabled={busy}>{validate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Валидирай</Button>
            <Button onClick={() => generate.mutate()} disabled={busy}>{generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Генерирай</Button>
          </div>
        }
      />

      {validation && <ValidationSummaryCard summary={validation} period={`${MONTHS[month - 1]} ${year}`} />}

      <Card>
        <CardHeader className="space-y-0"><CardTitle className="text-base">История на експортите</CardTitle><CardDescription>Всеки експорт се записва с валидационна обобщена справка.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {exportsQ.isLoading ? <div className="p-4"><TableSkeleton rows={5} cols={5} /></div>
            : exportsQ.isError ? <div className="p-6"><ErrorState onRetry={() => exportsQ.refetch()} /></div>
            : exports.length === 0 ? <div className="p-6"><EmptyState icon={FileCode2} title="Няма експорти" description="Генерирайте първия си SAF-T набор от данни за избран период." /></div>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Период</TableHead><TableHead>Статус</TableHead><TableHead className="text-right">Грешки/Предупр./Бележки</TableHead><TableHead>Генериран</TableHead><TableHead className="text-right">Действие</TableHead></TableRow></TableHeader>
                <TableBody>
                  {exports.map((ex) => {
                    const c = ex.validationSummary?.counts;
                    return (
                      <TableRow key={ex.id}>
                        <TableCell className="font-medium text-foreground">{MONTHS[ex.month - 1]} {ex.year}</TableCell>
                        <TableCell>{ex.status === 'failed' ? <Badge variant="destructive">Неуспешен</Badge> : (c && c.errors > 0) ? <Badge variant="warning">С грешки</Badge> : <Badge variant="success">Генериран</Badge>}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{c ? `${c.errors} / ${c.warnings} / ${c.info}` : '—'}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{dateTimeBG(ex.generatedAt)}</TableCell>
                        <TableCell className="text-right">
                          {ex.status === 'generated'
                            ? <Button size="sm" variant="outline" onClick={() => setPreviewId(ex.id)}><Eye className="h-4 w-4" /> Преглед</Button>
                            : <span className="text-xs text-destructive">{ex.error ?? 'грешка'}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <PreviewDialog exportId={previewId} onOpenChange={(v) => !v && setPreviewId(null)} />
    </div>
  );
}

function ValidationSummaryCard({ summary, period }: { summary: SaftValidationSummary; period: string }) {
  const Section = ({ title, icon: Icon, tone, issues }: { title: string; icon: typeof XCircle; tone: string; issues: SaftValidationIssue[] }) => (
    issues.length === 0 ? null : (
      <div>
        <p className={`mb-1 flex items-center gap-1.5 text-sm font-medium ${tone}`}><Icon className="h-4 w-4" /> {title} ({issues.length})</p>
        <ul className="space-y-0.5 pl-6 text-sm text-muted-foreground">
          {issues.map((i) => <li key={i.code}>{i.message}{i.count ? ` · ${i.count}` : ''}</li>)}
        </ul>
      </div>
    )
  );
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Валидация · {period}</CardTitle>
        {summary.ok ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Без грешки</Badge> : <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> {summary.counts.errors} грешки</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.errors.length + summary.warnings.length + summary.info.length === 0
          ? <p className="text-sm text-muted-foreground">Няма открити проблеми за периода.</p>
          : <>
              <Section title="Грешки" icon={XCircle} tone="text-destructive" issues={summary.errors} />
              <Section title="Предупреждения" icon={AlertTriangle} tone="text-warning" issues={summary.warnings} />
              <Section title="Бележки" icon={Info} tone="text-muted-foreground" issues={summary.info} />
            </>}
      </CardContent>
    </Card>
  );
}

function PreviewDialog({ exportId, onOpenChange }: { exportId: string | null; onOpenChange: (v: boolean) => void }) {
  const q = useQuery({ queryKey: ['saft', 'dataset', exportId], queryFn: () => Endpoints.saftDataset(exportId!), enabled: !!exportId });
  const ds = q.data as SaftDataset | undefined;

  const download = () => {
    if (!ds) return;
    const blob = new Blob([JSON.stringify(ds, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `saft-${ds.header.period.year}-${String(ds.header.period.month).padStart(2, '0')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('JSON файлът е изтеглен');
  };

  const C = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-lg bg-secondary/60 p-2 text-center"><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-bold tabular-nums text-foreground">{value}</p></div>
  );

  return (
    <Dialog open={!!exportId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileCode2 className="h-5 w-5 text-primary" /> SAF-T преглед</DialogTitle>
          <DialogDescription>{ds ? `${ds.header.companyName} · ${ds.header.period.from} – ${ds.header.period.to} · ${ds.header.currency}` : 'Зареждане…'}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <p className="py-6 text-sm text-muted-foreground">Зареждане…</p>
          : !ds ? <p className="py-6 text-sm text-muted-foreground">Няма данни.</p>
          : (
            <div className="space-y-4">
              <div>
                <p className="t-overline mb-1.5">Master Files</p>
                <div className="grid grid-cols-5 gap-2">
                  <C label="Клиенти" value={ds.counts.customers} /><C label="Доставчици" value={ds.counts.suppliers} /><C label="Артикули" value={ds.counts.products} /><C label="Сметки" value={ds.counts.accounts} /><C label="ДДС кодове" value={ds.counts.taxCodes} />
                </div>
              </div>
              <div>
                <p className="t-overline mb-1.5">Записи и документи</p>
                <div className="grid grid-cols-4 gap-2">
                  <C label="Статии (GL)" value={ds.counts.glEntries} /><C label="Продажби" value={ds.counts.salesInvoices} /><C label="Покупки" value={ds.counts.purchaseDocuments} /><C label="Плащания" value={ds.counts.payments} />
                </div>
              </div>
              <details className="rounded-lg border bg-secondary/30 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-foreground">Преглед на JSON (заглавен блок)</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(ds.header, null, 2)}</pre>
              </details>
            </div>
          )}
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={download} disabled={!ds}><Download className="h-4 w-4" /> Изтегли JSON</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
