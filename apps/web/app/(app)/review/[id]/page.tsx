'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, RotateCw, Sparkles, Check, X, BookOpenCheck, Loader2, FileText,
  CheckCircle2, Pencil, Save, AlertTriangle, History, ExternalLink, Eye, EyeOff, Info,
} from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError, API_BASE } from '@/lib/api/client';
import { useT } from '@/lib/i18n';
import type { DocumentRow } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfidenceBadge, ConfidenceMeter } from '@/components/app/confidence';
import { Notice } from '@/components/app/states';
import { AuditEntityHistory } from '@/components/app/audit/audit-entity-history';
import { AssistantPanel } from '@/components/app/assistant-panel';
import { eur, dateBG } from '@/lib/format';
import { cn } from '@/lib/utils';

const FIELD_LABELS: Record<string, string> = {
  invoice_number: 'Фактура №', document_number: 'Документ №', document_type: 'Тип документ',
  invoice_date: 'Дата', tax_event_date: 'Дата на дан. събитие', due_date: 'Падеж', currency: 'Валута',
  net_amount: 'Данъчна основа', vat_amount: 'ДДС', total_amount: 'Обща сума', vat_rate: 'ДДС ставка %', vat_code: 'ДДС код',
  vat_treatment: 'ДДС третиране', vat_exemption_reason: 'Основание за неначисляване',
  supplier_name: 'Доставчик', supplier_eik: 'ЕИК', supplier_vat: 'ДДС №',
  supplier_city: 'Град', supplier_address: 'Адрес', supplier_country: 'Държава',
  customer_name: 'Получател', customer_eik: 'ЕИК', customer_vat: 'ДДС №',
  customer_address: 'Адрес', customer_country: 'Държава',
  iban: 'IBAN', bank_name: 'Банка', bank_bic: 'BIC', payment_method: 'Начин на плащане', payment_reference: 'Основание',
  po_number: 'Поръчка №', contract_number: 'Договор №', delivery_note_number: 'Стокова разписка №',
  vehicle_reg_number: 'МПС рег. №',
  description: 'Описание', notes: 'Забележки', line_items: 'Редове (брой)',
};

/** Field groups shown in the extraction panel, in reading order. */
const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Документ', keys: ['document_type', 'invoice_number', 'document_number', 'invoice_date', 'tax_event_date', 'due_date', 'currency'] },
  { title: 'Суми и ДДС', keys: ['net_amount', 'vat_amount', 'total_amount', 'vat_rate', 'vat_code', 'vat_treatment', 'vat_exemption_reason'] },
  { title: 'Доставчик', keys: ['supplier_name', 'supplier_eik', 'supplier_vat', 'supplier_address', 'supplier_city', 'supplier_country'] },
  { title: 'Получател', keys: ['customer_name', 'customer_eik', 'customer_vat', 'customer_address', 'customer_country'] },
  { title: 'Плащане', keys: ['payment_method', 'iban', 'bank_name', 'bank_bic', 'payment_reference'] },
  { title: 'Други', keys: ['po_number', 'contract_number', 'delivery_note_number', 'vehicle_reg_number', 'description', 'notes', 'line_items'] },
];
const MONEY_KEYS = new Set(['net_amount', 'vat_amount', 'total_amount']);
const CLASS_SOURCE: Record<string, string> = { rule: 'правило', memory: 'памет', ai: 'AI', manual: 'ръчно' };

const SCAN_ACTIVE = (s?: string) => s === 'scanning' || s === 'pending_upload';
const STALL_MS = 20000;

interface ExtractedField { key: string; valueText?: string | null; confidence?: number; source?: string; validationStatus?: string }

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();

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

  // Source document preview (short-lived signed URL from the existing endpoint).
  const [showDoc, setShowDoc] = React.useState(true);
  const urlQ = useQuery({
    queryKey: ['downloadUrl', id],
    queryFn: () => Endpoints.downloadUrl(id).catch(() => null),
    enabled: showDoc && !!documentQ.data && !SCAN_ACTIVE(docStatus),
    staleTime: 4 * 60 * 1000,
  });
  const docUrl = urlQ.data?.url ? (urlQ.data.url.startsWith('/') ? `${API_BASE}${urlQ.data.url}` : urlQ.data.url) : null;
  // The API answers with X-Frame-Options: sameorigin, so the signed URL cannot be framed
  // directly; fetch the bytes and show them from a same-origin blob URL instead.
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [blobError, setBlobError] = React.useState(false);
  React.useEffect(() => {
    if (!docUrl) { setBlobUrl(null); return; }
    let revoked: string | null = null; let cancelled = false;
    setBlobError(false);
    fetch(docUrl).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then((b) => { if (cancelled) return; revoked = URL.createObjectURL(b); setBlobUrl(revoked); })
      .catch(() => { if (!cancelled) setBlobError(true); });
    return () => { cancelled = true; if (revoked) URL.revokeObjectURL(revoked); };
  }, [docUrl]);
  const mime = documentQ.data?.mimeType ?? '';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';

  const pkg = reviewQ.data?.package ?? null;
  const status: string = pkg?.status ?? 'none';
  // Posting state lives in its own endpoint (the review package itself never moves past 'approved').
  const postingQ = useQuery({
    queryKey: ['reviewPosting', pkg?.id],
    queryFn: () => Endpoints.postingForReview(pkg.id).catch(() => null),
    enabled: !!pkg?.id && (status === 'approved' || status === 'posted'),
  });
  const journalEntryId: string | undefined =
    reviewQ.data?.posting?.journalEntryId ?? pkg?.journalEntryId ?? postingQ.data?.journalEntryId ?? postingQ.data?.request?.journalEntryId;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['extraction', id] });
    qc.invalidateQueries({ queryKey: ['suggestion', id] });
    qc.invalidateQueries({ queryKey: ['reviewDetail', id] });
    qc.invalidateQueries({ queryKey: ['reviewPosting'] });
    qc.invalidateQueries({ queryKey: ['document', id] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const rerun = useMutation({ mutationFn: () => Endpoints.runExtraction(id), onSuccess: () => { toast.success('Извличането е стартирано'); setTimeout(invalidate, 1200); }, onError: errToast });
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

  const rawFields: ExtractedField[] | undefined = reviewQ.data?.extraction?.fields ?? extractionQ.data?.fields;
  const fields = React.useMemo<ExtractedField[]>(() => rawFields ?? [], [rawFields]);
  const byKey = React.useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);
  const overall: number | undefined = extractionQ.data?.overallConfidence ?? reviewQ.data?.extraction?.overallConfidence;
  const suggestion = suggestionQ.data ?? reviewQ.data?.suggestion ?? null;
  const flags = (reviewQ.data?.extraction?.flags ?? {}) as { lowConfidenceFields?: string[]; failedValidations?: string[]; missingRequired?: string[] };
  const flagItems = [
    { items: flags.failedValidations, label: 'Неуспешни проверки', tone: 'destructive' as const },
    { items: flags.missingRequired, label: 'Липсващи задължителни полета', tone: 'warning' as const },
    { items: flags.lowConfidenceFields, label: 'Полета с ниска сигурност', tone: 'warning' as const },
  ].filter((f) => (f.items?.length ?? 0) > 0);

  const diagnostics = (reviewQ.data?.extraction?.diagnostics ?? extractionQ.data?.diagnostics ?? null) as null | {
    provider?: string; model?: string; method?: string; layersRun?: string[];
    derived?: string[]; missingRequired?: string[];
    rejected?: { key: string; value: string; reason: string }[];
    fileType?: string; usedEmbeddedText?: boolean; devFallbackUsed?: boolean;
  };
  const hasPostingLines =
    ((pkg?.approvedPosting as unknown[] | undefined)?.length ?? 0) > 0 ||
    ((suggestion?.suggestedPosting as unknown[] | undefined)?.length ?? 0) > 0;

  // Header summary from extracted fields (nothing invented: only what the extraction produced).
  const supplier = byKey.supplier_name?.valueText;
  const total = byKey.total_amount?.valueText;
  const invDate = byKey.invoice_date?.valueText;
  const invNo = byKey.invoice_number?.valueText;
  const fileName = documentQ.data?.originalFilename ?? documentQ.data?.filename ?? 'Документ';
  const knownKeys = new Set(GROUPS.flatMap((g) => g.keys));
  const extraKeys = fields.map((f) => f.key).filter((k) => !knownKeys.has(k));
  const groups = [...GROUPS, ...(extraKeys.length ? [{ title: 'Допълнителни', keys: extraKeys }] : [])]
    .map((g) => ({ ...g, keys: g.keys.filter((k) => byKey[k]) }))
    .filter((g) => g.keys.length > 0);

  const canEdit = !!pkg && status !== 'approved' && status !== 'posted' && status !== 'rejected';
  const decided = status === 'approved' || status === 'rejected' || !!journalEntryId;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="break-all">{fileName}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {supplier && <span className="text-foreground">{supplier}</span>}
            {invNo && <span>№ {invNo}</span>}
            {invDate && <span>{invDate}</span>}
            {total && <span className="font-medium tabular-nums text-foreground">{isFinite(Number(total)) ? eur(Number(total)) : total}</span>}
            {documentQ.data?.createdAt && <span className="text-faint">качен {dateBG(documentQ.data.createdAt)}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => router.push('/review')}><ArrowLeft /> Към опашката</Button>
            <Button variant="outline" size="sm" onClick={() => rerun.mutate()} disabled={rerun.isPending || editing}>
              {rerun.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Извлечи отново
            </Button>
          </>
        }
      />

      {/* Pipeline state */}
      {docStatus === 'quarantined' ? (
        <Notice tone="destructive" icon={AlertTriangle} title={t('pipeline.quarantined')} />
      ) : (docStatus === 'failed' || scanDelayed) ? (
        <Notice
          tone="warning" icon={AlertTriangle}
          title={docStatus === 'failed' ? t('pipeline.failed') : t('pipeline.delayed')}
          action={<Button size="sm" variant="outline" onClick={() => rescan.mutate()} disabled={rescan.isPending}>{rescan.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />} {t('pipeline.retry')}</Button>}
        >
          {t('pipeline.delayedHint')}
        </Notice>
      ) : SCAN_ACTIVE(docStatus) ? (
        <Notice tone="neutral" icon={Loader2}>{t('pipeline.scanning')}</Notice>
      ) : null}

      {diagnostics?.devFallbackUsed && (
        <Notice tone="destructive" icon={AlertTriangle} title="Демонстрационни данни">
          Този документ е разчетен с демо-извадка, не с реално OCR. Стойностите не са от вашия документ: проверете и въведете всички полета ръчно преди одобрение.
        </Notice>
      )}

      {flagItems.length > 0 && (
        <Notice tone="warning" icon={AlertTriangle} title="Нужно е внимание преди одобрение">
          <ul className="mt-1 space-y-0.5">
            {flagItems.map((f) => (
              <li key={f.label} className={f.tone === 'destructive' ? 'text-destructive' : ''}>
                <span className="font-medium">{f.label}:</span> {(f.items ?? []).map((k) => FIELD_LABELS[k] ?? k).join(', ')}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Left: source document + extracted data ───────────────────── */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-faint" /> Оригинален документ</CardTitle>
                <CardDescription>{mime || documentQ.data?.detectedType || '—'}{documentQ.data?.sizeBytes ? ` · ${Math.round(documentQ.data.sizeBytes / 1024)} KB` : ''}</CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                {docUrl && <Button variant="ghost" size="sm" asChild><a href={docUrl} target="_blank" rel="noreferrer"><ExternalLink /> Отвори</a></Button>}
                <Button variant="ghost" size="sm" onClick={() => setShowDoc((v) => !v)}>{showDoc ? <><EyeOff /> Скрий</> : <><Eye /> Покажи</>}</Button>
              </div>
            </CardHeader>
            {showDoc && (
              <CardContent className="pt-0">
                <div className="overflow-hidden rounded-md border border-border bg-surface-2">
                  {urlQ.isLoading || (docUrl && !blobUrl && !blobError) ? (
                    <div className="skeleton h-[420px] rounded-none" />
                  ) : !docUrl || blobError ? (
                    <div className="flex h-40 items-center justify-center text-[13px] text-muted-foreground">Преглед не е наличен за този документ.{docUrl && <a className="ml-1 text-brand underline-offset-2 hover:underline" href={docUrl} target="_blank" rel="noreferrer">Отвори</a>}</div>
                  ) : isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={blobUrl!} alt={fileName} className="mx-auto max-h-[720px] w-auto" />
                  ) : isPdf ? (
                    <iframe src={`${blobUrl}#toolbar=0&navpanes=0`} title={fileName} className="h-[640px] w-full bg-card" />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-[13px] text-muted-foreground">Този тип файл не може да се покаже вграден. <a className="ml-1 text-brand underline-offset-2 hover:underline" href={docUrl} target="_blank" rel="noreferrer">Отвори</a></div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>Извлечени данни</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {overall !== undefined ? <>Обща сигурност <ConfidenceMeter value={overall} /></> : 'Очаква извличане'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                {canEdit && !editing && (
                  <Button size="sm" variant="outline" onClick={() => { setEditing(true); setDraft(Object.fromEntries(fields.map((f) => [f.key, f.valueText ?? '']))); }}>
                    <Pencil /> Коригирай
                  </Button>
                )}
                {editing && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft({}); }}>Отказ</Button>
                    <Button size="sm" onClick={() => saveFields.mutate({ ...draft, ...(newKey && newVal ? { [newKey]: newVal } : {}) })} disabled={saveFields.isPending}>
                      {saveFields.isPending ? <Loader2 className="animate-spin" /> : <Save />} Запази
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {extractionQ.isLoading ? (
                <div className="space-y-3 px-5 pb-5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-9" />)}</div>
              ) : fields.length === 0 && !editing ? (
                <p className="px-5 pb-5 text-[13px] text-muted-foreground">Все още няма извлечени полета. Натиснете „Извлечи отново“{pkg ? ' или „Коригирай“ за ръчно въвеждане' : ''}.</p>
              ) : (
                <div className="divide-y divide-border">
                  {groups.map((g) => (
                    <section key={g.title} className="px-5 py-4">
                      <h3 className="t-overline mb-2">{g.title}</h3>
                      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {g.keys.map((k) => {
                          const f = byKey[k];
                          const low = (f.confidence ?? 1) < 0.7 && f.source !== 'human';
                          const invalid = f.validationStatus === 'invalid';
                          return (
                            <div key={k} className={cn('flex min-w-0 items-start justify-between gap-3 rounded-md px-2 py-1.5 -mx-2', (low || invalid) && !editing && 'bg-warning-soft/60', invalid && !editing && 'bg-destructive-soft/60')}>
                              <div className="min-w-0 flex-1">
                                <dt className="text-2xs text-muted-foreground">{FIELD_LABELS[k] ?? k}</dt>
                                <dd className={cn('mt-0.5 break-words text-[13.5px] font-medium text-foreground', MONEY_KEYS.has(k) && 'tabular-nums')}>
                                  {editing
                                    ? <Input value={draft[k] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className="h-8 mt-1" />
                                    : (f.valueText && f.valueText !== '' ? (MONEY_KEYS.has(k) && /^-?\d+(\.\d+)?$/.test(f.valueText) ? eur(Number(f.valueText)) : f.valueText) : <span className="text-faint">—</span>)}
                                </dd>
                              </div>
                              {!editing && (
                                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                                  <ConfidenceBadge value={f.confidence} source={f.source} validated={f.validationStatus === 'valid'} />
                                  {invalid && <Badge variant="destructive">невалидно</Badge>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </dl>
                    </section>
                  ))}
                  {editing && (
                    <section className="px-5 py-4">
                      <h3 className="t-overline mb-2">Добави поле</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select value={newKey} onChange={(e) => setNewKey(e.target.value)}>
                          <option value="">Изберете поле…</option>
                          {Object.keys(FIELD_LABELS).filter((k) => !fields.some((f) => f.key === k)).map((k) => <option key={k} value={k}>{FIELD_LABELS[k]}</option>)}
                        </Select>
                        <Input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="Стойност" disabled={!newKey} />
                      </div>
                    </section>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {diagnostics && (
            <details className="group rounded-lg border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] font-medium text-foreground">
                <Info className="h-4 w-4 text-faint" /> Как е разчетен документът
                <span className="ml-auto text-2xs text-faint">{diagnostics.provider ?? '—'}{diagnostics.model ? ` · ${diagnostics.model}` : ''}</span>
              </summary>
              <div className="space-y-1.5 border-t border-border px-5 py-4 text-xs text-muted-foreground">
                <p>Метод: {diagnostics.method ?? '—'} · слоеве: {(diagnostics.layersRun ?? []).join(' → ') || '—'}</p>
                <p>Файл: {diagnostics.fileType ?? '—'} · вграден текст: {diagnostics.usedEmbeddedText ? 'да (без OCR)' : 'не'} · демо-извадка: {diagnostics.devFallbackUsed ? 'ДА' : 'не'}</p>
                {(diagnostics.derived?.length ?? 0) > 0 && <p>Изведени от други полета: {(diagnostics.derived ?? []).map((k) => FIELD_LABELS[k] ?? k).join(', ')}</p>}
                {(diagnostics.missingRequired?.length ?? 0) > 0 && <p className="text-warning">Липсващи задължителни: {(diagnostics.missingRequired ?? []).map((k) => FIELD_LABELS[k] ?? k).join(', ')}</p>}
                {(diagnostics.rejected?.length ?? 0) > 0 && (
                  <div>
                    <p className="mt-1 font-medium text-foreground">Отхвърлени кандидати</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {(diagnostics.rejected ?? []).map((r, i) => <li key={i}>{FIELD_LABELS[r.key] ?? r.key}: „{r.value}“ — {r.reason}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        {/* ── Right: decision rail ─────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Решение</CardTitle>
              <ReviewStatusBadge status={journalEntryId ? 'posted' : status} />
            </CardHeader>
            <CardContent className="space-y-3">
              {journalEntryId ? (
                <div className="rounded-md border border-success/25 bg-success-soft px-3 py-2.5 text-[13px]">
                  <p className="flex items-center gap-1.5 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Осчетоводено в главната книга</p>
                  <p className="mt-1 font-mono text-2xs text-muted-foreground">запис {String(journalEntryId).slice(0, 8)}…</p>
                  <Link href="/posting" className="mt-1 inline-block text-xs text-brand underline-offset-2 hover:underline">Виж в дневника →</Link>
                </div>
              ) : (
                <ol className="space-y-1.5 text-[13px]">
                  <Step done={fields.length > 0} active={fields.length === 0} label="Извличане" />
                  <Step done={status !== 'none'} active={status === 'none' && fields.length > 0} label="Преглед на полетата" />
                  <Step done={status === 'approved'} active={['pending', 'in_review', 'corrections_requested'].includes(status)} label="Одобрение" />
                  <Step done={false} active={status === 'approved'} label="Осчетоводяване" />
                </ol>
              )}

              <div className="space-y-2 pt-1">
                {status === 'none' && !journalEntryId && (
                  <Button className="w-full" onClick={() => startReview.mutate()} disabled={startReview.isPending}>
                    {startReview.isPending ? <Loader2 className="animate-spin" /> : <Check />} Започни преглед
                  </Button>
                )}
                {(status === 'pending' || status === 'in_review' || status === 'corrections_requested') && (
                  <>
                    <Button variant="success" className="w-full" onClick={() => approve.mutate()} disabled={approve.isPending || editing}>
                      {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />} Одобри
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => reject.mutate()} disabled={reject.isPending}>
                      <X /> Отхвърли
                    </Button>
                  </>
                )}
                {status === 'approved' && !journalEntryId && (
                  <>
                    <Button variant="success" className="w-full" onClick={() => post.mutate()} disabled={post.isPending || !hasPostingLines}
                      title={!hasPostingLines ? 'Няма осчетоводни редове' : undefined}>
                      {post.isPending ? <Loader2 className="animate-spin" /> : <BookOpenCheck />} Осчетоводи
                    </Button>
                    {!hasPostingLines && (
                      <p className="text-xs text-muted-foreground">
                        Няма осчетоводни редове — генерирайте предложение или въведете сумите (основа, ДДС, общо) чрез „Коригирай“ и генерирайте отново.
                      </p>
                    )}
                  </>
                )}
                {!decided && status !== 'none' && (
                  <p className="text-2xs text-faint">AI предлага, човекът решава. Нищо не се осчетоводява без вашето одобрение.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Предложение</CardTitle>
              <Button size="icon-sm" variant="ghost" aria-label="Генерирай отново" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
                {suggest.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              {!suggestion ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">Няма предложение. Acco предлага сметки и ДДС третиране — вие решавате.</p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
                    <Sparkles /> Генерирай предложение
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="t-overline">Категория разход</p>
                      {suggestion.classification && (
                        <span className="flex items-center gap-1.5">
                          <Badge variant={suggestion.classification.source === 'manual' ? 'brand' : suggestion.classification.source === 'memory' ? 'success' : 'neutral'}>
                            {CLASS_SOURCE[suggestion.classification.source] ?? suggestion.classification.source}
                          </Badge>
                          <ConfidenceBadge value={suggestion.classification.confidence} />
                        </span>
                      )}
                    </div>
                    <Select
                      value={suggestion.expenseCategory?.id ?? ''}
                      disabled={!suggestion.id || setCategory.isPending || status === 'approved' || status === 'posted'}
                      onChange={(e) => e.target.value && setCategory.mutate({ suggestionId: suggestion.id, categoryId: e.target.value })}
                    >
                      <option value="" disabled>Изберете категория</option>
                      {(categoriesQ.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nameBg} ({c.code})</option>)}
                    </Select>
                    {suggestion.classification?.reason && <p className="text-xs text-muted-foreground">{suggestion.classification.reason}</p>}
                  </div>
                  {Array.isArray(suggestion.suggestedPosting) && suggestion.suggestedPosting.length > 0 && (
                    <div>
                      <p className="t-overline mb-1.5">Осчетоводяване</p>
                      <div className="overflow-hidden rounded-md border border-border">
                        {suggestion.suggestedPosting.map((l: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 last:border-0">
                            <span className="w-12 font-mono text-xs text-foreground">{l.accountCode}</span>
                            <span className={cn('flex-1 text-xs', l.side === 'debit' ? 'text-foreground' : 'text-muted-foreground')}>{l.side === 'debit' ? 'Дебит' : 'Кредит'}</span>
                            <span className="font-medium tabular-nums">{eur(l.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestion.vat && (
                    <div className="rounded-md bg-surface-2 px-3 py-2">
                      <p className="text-xs font-medium text-foreground">ДДС: {suggestion.vat.treatment} · {suggestion.vat.rate}%</p>
                      {suggestion.vat.explanation && <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.vat.explanation}</p>}
                    </div>
                  )}
                  {suggestion.explanation && <p className="text-xs text-muted-foreground">{suggestion.explanation}</p>}
                </>
              )}
            </CardContent>
          </Card>

          <AssistantPanel surface="invoice" context={{ documentId: id }} />

          {pkg?.id && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-faint" /> История</CardTitle></CardHeader>
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

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <li className={cn('flex items-center gap-2', done ? 'text-muted-foreground' : active ? 'text-foreground' : 'text-faint')}>
      <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border text-[9px]',
        done ? 'border-success bg-success text-success-foreground' : active ? 'border-foreground' : 'border-border')}>
        {done ? <Check className="h-2.5 w-2.5" /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> : null}
      </span>
      <span className={cn(done && 'line-through decoration-border')}>{label}</span>
    </li>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'destructive' }> = {
    none: { label: 'Не е започнат', variant: 'neutral' },
    pending: { label: 'Чака преглед', variant: 'warning' },
    in_review: { label: 'В преглед', variant: 'warning' },
    corrections_requested: { label: 'Искани корекции', variant: 'warning' },
    approved: { label: 'Одобрен', variant: 'success' },
    rejected: { label: 'Отхвърлен', variant: 'destructive' },
    posted: { label: 'Осчетоводен', variant: 'success' },
  };
  const m = map[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}
