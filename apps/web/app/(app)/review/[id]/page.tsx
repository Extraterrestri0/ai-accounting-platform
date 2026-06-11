'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, RotateCw, Sparkles, Check, X, BookOpenCheck, Loader2, FileText, CheckCircle2, Pencil, Save, AlertTriangle, History } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useT } from '@/lib/i18n';
import type { DocumentRow } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfidenceBadge, ConfidenceMeter } from '@/components/app/confidence';
import { DualMoney } from '@/components/app/money';
import { AuditEntityHistory } from '@/components/app/audit/audit-entity-history';
import { eur } from '@/lib/format';

const FIELD_LABELS: Record<string, string> = {
  invoice_number: 'Фактура №', document_number: 'Документ №', document_type: 'Тип документ',
  invoice_date: 'Дата', tax_event_date: 'Дата на дан. събитие', due_date: 'Падеж', currency: 'Валута',
  net_amount: 'Данъчна основа', vat_amount: 'ДДС', total_amount: 'Обща сума', vat_rate: 'ДДС ставка %', vat_code: 'ДДС код',
  vat_treatment: 'ДДС третиране', vat_exemption_reason: 'Основание за неначисляване',
  supplier_name: 'Доставчик', supplier_eik: 'ЕИК (доставчик)', supplier_vat: 'ДДС № (доставчик)',
  supplier_city: 'Град', supplier_address: 'Адрес (доставчик)', supplier_country: 'Държава (доставчик)',
  customer_name: 'Получател', customer_eik: 'ЕИК (получател)', customer_vat: 'ДДС № (получател)',
  customer_address: 'Адрес (получател)', customer_country: 'Държава (получател)',
  iban: 'IBAN', bank_name: 'Банка', bank_bic: 'BIC', payment_method: 'Начин на плащане', payment_reference: 'Основание',
  po_number: 'Поръчка №', contract_number: 'Договор №', delivery_note_number: 'Стокова разписка №',
  vehicle_reg_number: 'МПС рег. №',
  description: 'Описание', notes: 'Забележки', line_items: 'Редове (брой)',
};

const CLASS_SOURCE: Record<string, string> = { rule: 'правило', memory: 'памет', ai: 'AI', manual: 'ръчно' };

const SCAN_ACTIVE = (s?: string) => s === 'scanning' || s === 'pending_upload';
const STALL_MS = 20000; // how long a doc may sit in 'scanning' before we call it delayed

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();

  // Document status — poll while the scan/extract pipeline is still working so a stuck doc
  // (e.g. Redis/worker down) surfaces an actionable banner instead of an empty "no fields" page.
  const documentQ = useQuery({
    queryKey: ['document', id],
    queryFn: () => Endpoints.document(id).catch(() => null),
    refetchInterval: (q) => (SCAN_ACTIVE((q.state.data as DocumentRow | null)?.status) ? 4000 : false),
  });
  const docStatus = documentQ.data?.status;
  const [scanSince, setScanSince] = React.useState<number | null>(null);
  React.useEffect(() => {
    setScanSince((prev) => (SCAN_ACTIVE(docStatus) ? (prev ?? Date.now()) : null));
  }, [docStatus]);
  const scanDelayed = scanSince != null && Date.now() - scanSince > STALL_MS;

  const extractionQ = useQuery({ queryKey: ['extraction', id], queryFn: () => Endpoints.extraction(id).catch(() => null) });
  const suggestionQ = useQuery({ queryKey: ['suggestion', id], queryFn: () => Endpoints.suggestion(id).catch(() => null) });
  const reviewQ = useQuery({ queryKey: ['reviewDetail', id], queryFn: () => Endpoints.reviewDetail(id).catch(() => null) });
  const categoriesQ = useQuery({ queryKey: ['expenseCategories'], queryFn: () => Endpoints.expenseCategories().catch(() => []) });

  const pkg = reviewQ.data?.package ?? null;
  const status: string = pkg?.status ?? 'none';
  const journalEntryId: string | undefined = reviewQ.data?.posting?.journalEntryId ?? pkg?.journalEntryId;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['extraction', id] });
    qc.invalidateQueries({ queryKey: ['suggestion', id] });
    qc.invalidateQueries({ queryKey: ['reviewDetail', id] });
    qc.invalidateQueries({ queryKey: ['document', id] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const rerun = useMutation({ mutationFn: () => Endpoints.runExtraction(id), onSuccess: () => { toast.success('Извличането е стартирано'); setTimeout(invalidate, 1200); }, onError: errToast });
  // Recovery: re-enqueue the scan when the pipeline stalled or failed (Redis/worker was down).
  const rescan = useMutation({
    mutationFn: () => Endpoints.rescanDocument(id),
    onSuccess: () => { toast.success(t('pipeline.rescan')); setScanSince(Date.now()); qc.invalidateQueries({ queryKey: ['document', id] }); },
    onError: errToast,
  });
  const suggest = useMutation({ mutationFn: () => Endpoints.generateSuggestion(id), onSuccess: () => { toast.success('Генерирано предложение'); invalidate(); }, onError: errToast });
  const startReview = useMutation({ mutationFn: () => Endpoints.createReview(id), onSuccess: () => { toast.success('Прегледът е започнат'); invalidate(); }, onError: errToast });
  const approve = useMutation({ mutationFn: () => Endpoints.approveReview(pkg.id), onSuccess: () => { toast.success('Одобрено'); invalidate(); }, onError: errToast });
  const reject = useMutation({ mutationFn: () => Endpoints.rejectReview(pkg.id, 'Отхвърлено от ревюъра'), onSuccess: () => { toast.success('Отхвърлено'); invalidate(); }, onError: errToast });
  const post = useMutation({ mutationFn: () => Endpoints.postReview(pkg.id), onSuccess: () => { toast.success('Осчетоводено в главната книга'); invalidate(); }, onError: errToast });
  const setCategory = useMutation({
    mutationFn: (vars: { suggestionId: string; categoryId: string }) => Endpoints.setSuggestionCategory(vars.suggestionId, vars.categoryId),
    onSuccess: () => { toast.success('Категорията е променена'); invalidate(); }, onError: errToast,
  });

  // --- manual field editing / adding ---
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [newKey, setNewKey] = React.useState('');
  const [newVal, setNewVal] = React.useState('');
  const saveFields = useMutation({
    mutationFn: (f: Record<string, string>) => Endpoints.editFields(pkg.id, f),
    onSuccess: () => { toast.success('Полетата са запазени'); setEditing(false); setDraft({}); setNewKey(''); setNewVal(''); setTimeout(invalidate, 200); },
    onError: errToast,
  });

  function errToast(e: unknown) { toast.error('Грешка', { description: e instanceof ApiError ? e.message : 'Опитайте отново' }); }

  const fields: any[] = reviewQ.data?.extraction?.fields ?? extractionQ.data?.fields ?? [];
  const overall: number | undefined = extractionQ.data?.overallConfidence ?? reviewQ.data?.extraction?.overallConfidence;
  const suggestion = suggestionQ.data ?? reviewQ.data?.suggestion ?? null;
  const flags = (reviewQ.data?.extraction?.flags ?? {}) as { lowConfidenceFields?: string[]; failedValidations?: string[]; missingRequired?: string[] };
  const flagItems = [
    { items: flags.failedValidations, label: 'Неуспешни проверки', tone: 'destructive' as const },
    { items: flags.missingRequired, label: 'Липсващи задължителни полета', tone: 'warning' as const },
    { items: flags.lowConfidenceFields, label: 'Полета с ниска сигурност', tone: 'warning' as const },
  ].filter((f) => (f.items?.length ?? 0) > 0);

  // Extraction diagnostics (why a field was found / derived / rejected) — makes a miss explainable.
  const diagnostics = (reviewQ.data?.extraction?.diagnostics ?? extractionQ.data?.diagnostics ?? null) as null | {
    provider?: string; model?: string; method?: string; layersRun?: string[];
    derived?: string[]; missingRequired?: string[];
    rejected?: { key: string; value: string; reason: string }[];
    fileType?: string; usedEmbeddedText?: boolean; devFallbackUsed?: boolean;
  };
  // Posting needs lines: corrected/approved lines on the package, or the AI suggestion's lines.
  const hasPostingLines =
    ((pkg?.approvedPosting as unknown[] | undefined)?.length ?? 0) > 0 ||
    ((suggestion?.suggestedPosting as unknown[] | undefined)?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/review')} aria-label="Назад"><ArrowLeft className="h-5 w-5" /></Button>
        <PageHeader title="Преглед на документ" description={`Документ ${id.slice(0, 8)}…`} />
      </div>

      {docStatus === 'quarantined' ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('pipeline.quarantined')}</span>
        </div>
      ) : (docStatus === 'failed' || scanDelayed) ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm">
          <div className="flex items-start gap-2 text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{docStatus === 'failed' ? t('pipeline.failed') : t('pipeline.delayed')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('pipeline.delayedHint')}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => rescan.mutate()} disabled={rescan.isPending}>
            {rescan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} {t('pipeline.retry')}
          </Button>
        </div>
      ) : SCAN_ACTIVE(docStatus) ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>{t('pipeline.scanning')}</span>
        </div>
      ) : null}

      {flagItems.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-warning"><AlertTriangle className="h-4 w-4" /> Нужно е внимание — проверете и коригирайте полетата</p>
          <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-muted-foreground">
            {flagItems.map((f) => (
              <li key={f.label} className={f.tone === 'destructive' ? 'text-destructive' : ''}>
                {f.label}: {(f.items ?? []).map((k) => FIELD_LABELS[k] ?? k).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnostics?.devFallbackUsed && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><strong>Демонстрационни данни</strong> — този документ е разчетен с демо-извадка, НЕ с реално OCR. Стойностите не са от вашия документ: проверете и въведете всички полета ръчно преди одобрение.</span>
        </div>
      )}

      {diagnostics && (
        <details className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Диагностика на извличането</summary>
          <div className="mt-2 space-y-1">
            <p>Източник: <span className="font-medium">{diagnostics.provider ?? '—'}</span>{diagnostics.model ? ` (${diagnostics.model})` : ''} · метод: {diagnostics.method ?? '—'} · слоеве: {(diagnostics.layersRun ?? []).join(' → ')}</p>
            <p>Файл: {diagnostics.fileType ?? '—'} · вграден текст: {diagnostics.usedEmbeddedText ? 'да (без OCR)' : 'не'} · демо-извадка: {diagnostics.devFallbackUsed ? 'ДА' : 'не'}</p>
            {(diagnostics.derived?.length ?? 0) > 0 && (
              <p>Изведени (от други полета): {(diagnostics.derived ?? []).map((k) => FIELD_LABELS[k] ?? k).join(', ')}</p>
            )}
            {(diagnostics.missingRequired?.length ?? 0) > 0 && (
              <p className="text-warning">Липсващи задължителни: {(diagnostics.missingRequired ?? []).map((k) => FIELD_LABELS[k] ?? k).join(', ')}</p>
            )}
            {(diagnostics.rejected?.length ?? 0) > 0 && (
              <div>
                <p className="mt-1">Отхвърлени кандидати (защо едно поле е празно/различно):</p>
                <ul className="mt-0.5 space-y-0.5 pl-4">
                  {(diagnostics.rejected ?? []).map((r, i) => (
                    <li key={i}>{FIELD_LABELS[r.key] ?? r.key}: „{r.value}“ — {r.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Extraction */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Извлечени данни</CardTitle>
              <CardDescription className="flex items-center gap-2">{overall !== undefined ? <>Обща сигурност <ConfidenceMeter value={overall} /></> : 'Очаква извличане'}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {pkg && !editing && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(true); setDraft(Object.fromEntries(fields.map((f) => [f.key, f.valueText ?? '']))); }}>
                  <Pencil className="h-4 w-4" /> Редактирай
                </Button>
              )}
              {editing && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft({}); }}>Отказ</Button>
                  <Button size="sm" variant="success" onClick={() => saveFields.mutate({ ...draft, ...(newKey && newVal ? { [newKey]: newVal } : {}) })} disabled={saveFields.isPending}>
                    {saveFields.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Запази
                  </Button>
                </>
              )}
              {!editing && (
                <Button size="sm" variant="outline" onClick={() => rerun.mutate()} disabled={rerun.isPending}>
                  {rerun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Извлечи отново
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {extractionQ.isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Зареждане…</p>
            ) : fields.length === 0 && !editing ? (
              <p className="p-6 text-sm text-muted-foreground">Все още няма извлечени полета. Натиснете „Извлечи отново“{pkg ? ' или „Редактирай“ за ръчно въвеждане' : ''}.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Поле</TableHead><TableHead>Стойност</TableHead><TableHead>Сигурност</TableHead><TableHead>Проверка</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fields.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell className="text-muted-foreground">{FIELD_LABELS[f.key] ?? f.key}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {editing ? (
                          <Input value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} className="h-8" />
                        ) : (f.valueText ?? '—')}
                      </TableCell>
                      <TableCell><ConfidenceBadge value={f.confidence} source={f.source} /></TableCell>
                      <TableCell><ValidationBadge status={f.validationStatus} /></TableCell>
                    </TableRow>
                  ))}
                  {editing && (
                    <TableRow>
                      <TableCell>
                        <select value={newKey} onChange={(e) => setNewKey(e.target.value)} className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <option value="">+ Добави поле…</option>
                          {Object.keys(FIELD_LABELS).filter((k) => !fields.some((f) => f.key === k)).map((k) => <option key={k} value={k}>{FIELD_LABELS[k]}</option>)}
                        </select>
                      </TableCell>
                      <TableCell colSpan={3}>
                        <Input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="Стойност" className="h-8" disabled={!newKey} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Decision */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Статус на преглед</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ReviewStatusBadge status={status} />
              {journalEntryId && (
                <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Осчетоводено</p>
                  <p className="mt-1 text-xs text-muted-foreground">Запис: {String(journalEntryId).slice(0, 8)}…</p>
                  <Link href="/posting" className="mt-1 inline-block text-xs text-primary hover:underline">Виж в главната книга →</Link>
                </div>
              )}
              <div className="space-y-2 pt-1">
                {status === 'none' && (
                  <Button className="w-full" onClick={() => startReview.mutate()} disabled={startReview.isPending}>
                    {startReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Започни преглед
                  </Button>
                )}
                {(status === 'pending' || status === 'in_review' || status === 'corrections_requested') && (
                  <>
                    <Button variant="success" className="w-full" onClick={() => approve.mutate()} disabled={approve.isPending}>
                      {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Одобри
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => reject.mutate()} disabled={reject.isPending}>
                      <X className="h-4 w-4" /> Отхвърли
                    </Button>
                  </>
                )}
                {status === 'approved' && !journalEntryId && (
                  <>
                    <Button variant="success" className="w-full" onClick={() => post.mutate()} disabled={post.isPending || !hasPostingLines}
                      title={!hasPostingLines ? 'Няма осчетоводни редове' : undefined}>
                      {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />} Осчетоводи
                    </Button>
                    {!hasPostingLines && (
                      <p className="text-xs text-muted-foreground">
                        Няма осчетоводни редове — генерирайте „AI предложение“ или въведете сумите (данъчна основа, ДДС, обща сума) чрез „Редактирай“, после генерирайте отново.
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Suggestion */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI предложение</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
                {suggest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!suggestion ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">Няма предложение. AI предлага сметки и ДДС — човекът решава.</p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
                    <Sparkles className="h-4 w-4" /> Генерирай предложение
                  </Button>
                </div>
              ) : (
                <>
                  {/* Task 1.2 — expense category (classification) */}
                  <div className="space-y-1.5 rounded-md border border-border bg-secondary/40 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Категория разход</p>
                      {suggestion.classification && (
                        <span className="flex items-center gap-1.5">
                          <Badge variant={suggestion.classification.source === 'manual' ? 'default' : suggestion.classification.source === 'memory' ? 'success' : 'neutral'}>
                            {CLASS_SOURCE[suggestion.classification.source] ?? suggestion.classification.source}
                          </Badge>
                          <ConfidenceBadge value={suggestion.classification.confidence} />
                        </span>
                      )}
                    </div>
                    <select
                      value={suggestion.expenseCategory?.id ?? ''}
                      disabled={!suggestion.id || setCategory.isPending || status === 'approved' || status === 'posted'}
                      onChange={(e) => e.target.value && setCategory.mutate({ suggestionId: suggestion.id, categoryId: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    >
                      <option value="" disabled>— изберете категория —</option>
                      {(categoriesQ.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nameBg} ({c.code})</option>)}
                    </select>
                    {suggestion.classification?.reason && <p className="text-xs text-muted-foreground">{suggestion.classification.reason}</p>}
                  </div>
                  {Array.isArray(suggestion.suggestedPosting) && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Предложено осчетоводяване</p>
                      {suggestion.suggestedPosting.map((l: any, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-md bg-secondary/60 px-2.5 py-1.5">
                          <span className="font-mono text-xs">{l.accountCode}</span>
                          <span className={l.side === 'debit' ? 'text-foreground' : 'text-muted-foreground'}>{l.side === 'debit' ? 'Дебит' : 'Кредит'}</span>
                          <span className="font-medium tabular-nums">{eur(l.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {suggestion.vat && (
                    <div className="rounded-md bg-primary-soft/60 px-2.5 py-2">
                      <p className="text-xs font-medium text-accent-foreground">ДДС: {suggestion.vat.treatment} · {suggestion.vat.rate}%</p>
                      <p className="text-xs text-muted-foreground">{suggestion.vat.explanation}</p>
                    </div>
                  )}
                  {suggestion.explanation && <p className="text-xs text-muted-foreground">{suggestion.explanation}</p>}
                </>
              )}
            </CardContent>
          </Card>

          {pkg?.id && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-muted-foreground" /> Одитна история</CardTitle></CardHeader>
              <CardContent>
                <AuditEntityHistory entityType="review_package" entityId={pkg.id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ValidationBadge({ status }: { status?: string }) {
  if (status === 'valid') return <Badge variant="success">Валидно ✓</Badge>;
  if (status === 'invalid') return <Badge variant="destructive">Невалидно</Badge>;
  return <Badge variant="neutral">—</Badge>;
}
function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    none: { label: 'Не е започнат', variant: 'neutral' },
    pending: { label: 'Чака преглед', variant: 'warning' },
    in_review: { label: 'В преглед', variant: 'warning' },
    corrections_requested: { label: 'Искани корекции', variant: 'warning' },
    approved: { label: 'Одобрен', variant: 'success' },
    rejected: { label: 'Отхвърлен', variant: 'destructive' },
    posted: { label: 'Осчетоводен', variant: 'success' },
  };
  const m = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
