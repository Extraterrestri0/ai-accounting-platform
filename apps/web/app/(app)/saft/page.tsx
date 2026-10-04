'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileCode2, Play, ShieldCheck, Loader2, Download, Eye, XCircle, AlertTriangle, Info, CheckCircle2, FileDown } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState, ErrorState, TableSkeleton, Notice } from '@/components/app/states';
import { SaftStatusBadge, SaftXsdBadge, isInFlight, hasXmlArtifact } from '@/components/app/saft-status';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { dateTimeBG } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SaftDataset, SaftExportRecord, SaftValidationSummary, SaftValidationIssue, SaftXsdError } from '@/lib/api/types';

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR - 2, THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1];

async function downloadXml(id: string): Promise<void> {
  try {
    const dl = await Endpoints.saftDownload(id);
    window.open(dl.url, '_blank', 'noopener');
  } catch (e) {
    toast.error('Изтеглянето е неуспешно', { description: e instanceof ApiError ? e.message : '' });
  }
}

export default function SaftPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [year, setYear] = React.useState(THIS_YEAR);
  const [month, setMonth] = React.useState(new Date().getMonth() + 1);
  const [validation, setValidation] = React.useState<SaftValidationSummary | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const exportsQ = useQuery({
    queryKey: ['saft', 'exports', companyId],
    queryFn: () => Endpoints.saftExports({ pageSize: 50 }),
    enabled: !!companyId,
    // Poll while any export is queued/processing so the async lifecycle updates live.
    refetchInterval: (q) => ((q.state.data ?? []).some((e) => isInFlight(e.status)) ? 3000 : false),
  });

  const validate = useMutation({
    mutationFn: () => Endpoints.saftValidate(year, month),
    onSuccess: (s) => { setValidation(s); toast.success('Валидацията завърши'); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const generate = useMutation({
    mutationFn: () => Endpoints.generateSaftExport(year, month),
    onSuccess: (r) => {
      if (r.status === 'failed') toast.error('Генерирането е неуспешно');
      else if (isInFlight(r.status)) toast.success('Експортът е поставен в опашка и се обработва');
      else { setValidation(r.validationSummary ?? null); toast.success('SAF-T наборът е генериран'); }
      qc.invalidateQueries({ queryKey: ['saft'] });
    },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const busy = validate.isPending || generate.isPending;
  const exports = exportsQ.data ?? [];
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SAF-T"
        description="Нормализиран SAF-T набор (Header, Master Files, GL, изходни документи) и XML от съществуващите данни. Файлът се изтегля за ръчно подаване и не се изпраща към НАП."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Месец" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</Select>
            <Select aria-label="Година" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
            <Button variant="outline" onClick={() => validate.mutate()} disabled={busy}>{validate.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Валидирай</Button>
            <Button onClick={() => generate.mutate()} disabled={busy}>{generate.isPending ? <Loader2 className="animate-spin" /> : <Play />} Генерирай</Button>
          </div>
        }
      />

      {validation
        ? <ValidationSummaryCard summary={validation} period={periodLabel} onDismiss={() => setValidation(null)} />
        : <Notice tone="neutral" icon={ShieldCheck} title={`Готовност за ${periodLabel}`}>Валидирайте периода, за да видите грешки и предупреждения преди генериране. Генерирането също връща валидационна справка.</Notice>}

      <Card>
        <CardHeader>
          <CardTitle>История на експортите</CardTitle>
          <CardDescription>Всеки експорт се записва с валидационна справка и XSD статус.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {exportsQ.isLoading ? <TableSkeleton rows={5} cols={6} />
            : exportsQ.isError ? <div className="p-5"><ErrorState onRetry={() => exportsQ.refetch()} /></div>
            : exports.length === 0 ? <EmptyState icon={FileCode2} title="Няма експорти" description="Генерирайте първия си SAF-T експорт за избран период." />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Период</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>XSD</TableHead>
                    <TableHead className="num">Грешки</TableHead>
                    <TableHead className="num">Предупр.</TableHead>
                    <TableHead className="num">Бележки</TableHead>
                    <TableHead>Генериран</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Действие</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((ex) => {
                    const c = ex.validationSummary?.counts;
                    return (
                      <TableRow key={ex.id}>
                        <TableCell className="whitespace-nowrap font-medium text-foreground">{MONTHS[ex.month - 1]} {ex.year}</TableCell>
                        <TableCell><SaftStatusBadge status={ex.status} /></TableCell>
                        <TableCell>{hasXmlArtifact(ex.status) ? <SaftXsdBadge xsdValid={ex.xsdValid} /> : <span className="text-faint">—</span>}</TableCell>
                        <TableCell className={cn('num', (c?.errors ?? 0) > 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>{c ? c.errors : '—'}</TableCell>
                        <TableCell className={cn('num', (c?.warnings ?? 0) > 0 ? 'text-warning' : 'text-muted-foreground')}>{c ? c.warnings : '—'}</TableCell>
                        <TableCell className="num text-muted-foreground">{c ? c.info : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{dateTimeBG(ex.generatedAt)}</TableCell>
                        <TableCell className="text-right"><RowActions ex={ex} onPreview={() => setPreviewId(ex.id)} /></TableCell>
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

function RowActions({ ex, onPreview }: { ex: SaftExportRecord; onPreview: () => void }) {
  if (ex.status === 'failed') return <span className="text-xs text-destructive">{ex.error ?? 'грешка'}</span>;
  if (isInFlight(ex.status)) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Обработва се</span>;
  return (
    <div className="inline-flex gap-1">
      {hasXmlArtifact(ex.status) && <Button size="sm" variant="outline" onClick={() => void downloadXml(ex.id)}><FileDown /> XML</Button>}
      <Button size="sm" variant="ghost" onClick={onPreview}><Eye /> Преглед</Button>
    </div>
  );
}

function ValidationSummaryCard({ summary, period, onDismiss }: { summary: SaftValidationSummary; period: string; onDismiss: () => void }) {
  const total = summary.errors.length + summary.warnings.length + summary.info.length;
  const Section = ({ title, icon: Icon, tone, issues }: { title: string; icon: typeof XCircle; tone: string; issues: SaftValidationIssue[] }) => (
    issues.length === 0 ? null : (
      <div>
        <p className={cn('mb-1.5 flex items-center gap-1.5 text-[13px] font-medium', tone)}><Icon className="h-4 w-4" /> {title} <span className="tabular-nums text-muted-foreground">({issues.length})</span></p>
        <ul className="space-y-1 pl-6 text-[13px] text-muted-foreground">
          {issues.map((i) => <li key={i.code}><span className="font-mono text-xs text-faint">{i.code}</span> {i.message}{i.count ? <span className="tabular-nums"> · {i.count}</span> : ''}</li>)}
        </ul>
      </div>
    )
  );
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Валидация · {period}</CardTitle>
          <CardDescription className="mt-1">
            <span className={cn('tabular-nums', summary.counts.errors > 0 ? 'font-medium text-destructive' : 'text-foreground')}>{summary.counts.errors}</span> грешки ·{' '}
            <span className={cn('tabular-nums', summary.counts.warnings > 0 ? 'font-medium text-warning' : 'text-foreground')}>{summary.counts.warnings}</span> предупреждения ·{' '}
            <span className="tabular-nums text-foreground">{summary.counts.info}</span> бележки
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {summary.ok ? <Badge variant="success" dot>Без грешки</Badge> : <Badge variant="destructive" dot>{summary.counts.errors} грешки</Badge>}
          <Button variant="ghost" size="icon-sm" aria-label="Скрий валидацията" onClick={onDismiss}><XCircle /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border pt-4">
        {total === 0
          ? <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Няма открити проблеми за периода.</p>
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
  const recordQ = useQuery({ queryKey: ['saft', 'export', exportId], queryFn: () => Endpoints.saftExport(exportId!), enabled: !!exportId });
  const datasetQ = useQuery({ queryKey: ['saft', 'dataset', exportId], queryFn: () => Endpoints.saftDataset(exportId!), enabled: !!exportId });
  const ds = datasetQ.data as SaftDataset | undefined;
  const rec = recordQ.data;

  const downloadJson = () => {
    if (!ds) return;
    const blob = new Blob([JSON.stringify(ds, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `saft-${ds.header.period.year}-${String(ds.header.period.month).padStart(2, '0')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('JSON файлът е изтеглен');
  };

  const xsdErrors: SaftXsdError[] = rec?.xsdErrors ?? [];

  return (
    <Dialog open={!!exportId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>SAF-T преглед</DialogTitle>
          <DialogDescription>{ds ? `${ds.header.companyName} · ${ds.header.period.from} – ${ds.header.period.to} · ${ds.header.currency}` : 'Зареждане…'}</DialogDescription>
        </DialogHeader>
        {datasetQ.isLoading ? <TableSkeleton rows={4} cols={4} />
          : !ds ? <p className="py-6 text-[13px] text-muted-foreground">Няма данни.</p>
          : (
            <div className="space-y-5">
              {rec && rec.status === 'completed' && (
                <div className="flex flex-wrap items-center gap-2">
                  <SaftStatusBadge status={rec.status} />
                  <SaftXsdBadge xsdValid={rec.xsdValid} />
                  {rec.schemaVersion && <span className="t-caption">схема {rec.schemaVersion}</span>}
                </div>
              )}
              {xsdErrors.length > 0 && (
                <Notice tone="destructive" icon={XCircle} title={`XSD грешки (${xsdErrors.length})`}>
                  <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto font-mono text-xs">
                    {xsdErrors.slice(0, 50).map((e, i) => <li key={i}>{e.line ? `ред ${e.line}: ` : ''}{e.message}</li>)}
                  </ul>
                </Notice>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <CountGroup title="Master Files" items={[['Клиенти', ds.counts.customers], ['Доставчици', ds.counts.suppliers], ['Артикули', ds.counts.products], ['Сметки', ds.counts.accounts], ['ДДС кодове', ds.counts.taxCodes]]} />
                <CountGroup title="Записи и документи" items={[['Статии (GL)', ds.counts.glEntries], ['Продажби', ds.counts.salesInvoices], ['Покупки', ds.counts.purchaseDocuments], ['Плащания', ds.counts.payments]]} />
              </div>
              <div>
                <p className="t-overline mb-1.5">Header (JSON)</p>
                <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-foreground">{JSON.stringify(ds.header, null, 2)}</pre>
              </div>
            </div>
          )}
        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {rec && hasXmlArtifact(rec.status) && <Button variant="outline" onClick={() => exportId && void downloadXml(exportId)}><FileDown /> Изтегли XML</Button>}
            <Button variant="outline" onClick={downloadJson} disabled={!ds}><Download /> Изтегли JSON</Button>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Затвори</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Key/value list of dataset counts inside the preview. */
function CountGroup({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div className="rounded-lg border border-border">
      <p className="t-overline border-b border-border px-3 py-2">{title}</p>
      <dl className="divide-y divide-border">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-1.5 text-[13px]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
