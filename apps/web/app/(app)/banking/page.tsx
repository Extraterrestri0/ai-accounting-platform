'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark, Plus, Upload, Loader2, Star, CheckCircle2, Link2, Banknote, AlertTriangle, FileSpreadsheet, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState, ErrorState, TableSkeleton, Notice } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Money } from '@/components/app/money';
import { ConfidenceBadge } from '@/components/app/confidence';
import { eur, dateBG, bytes, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BankTransaction, ImportReport, MatchSuggestion, OpenItem } from '@/lib/api/types';

type StatusFilter = 'unreconciled' | 'reconciled' | 'ignored' | 'all';
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'unreconciled', label: 'Неравнени' }, { value: 'reconciled', label: 'Равнени' }, { value: 'ignored', label: 'Игнорирани' }, { value: 'all', label: 'Всички' },
];
const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  unreconciled: { label: 'Неравнена', variant: 'warning' }, reconciled: { label: 'Равнена', variant: 'success' }, ignored: { label: 'Игнорирана', variant: 'neutral' },
};

/** Bank amounts arrive unsigned with a direction; show outbound as negative. */
const signedAmount = (t: BankTransaction) => (t.transactionType === 'inbound' ? Math.abs(toNumber(t.amount)) : -Math.abs(toNumber(t.amount)));

export default function BankingPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<StatusFilter>('unreconciled');
  const [reconcileTxn, setReconcileTxn] = React.useState<BankTransaction | null>(null);

  const summaryQ = useQuery({ queryKey: ['banking', 'summary', companyId], queryFn: () => Endpoints.bankingSummary(), enabled: !!companyId });
  const txnQ = useQuery({ queryKey: ['banking', 'transactions', companyId, status], queryFn: () => Endpoints.bankTransactions(status === 'all' ? {} : { status }), enabled: !!companyId });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['banking'] }); qc.invalidateQueries({ queryKey: ['arap'] }); };

  const s = summaryQ.data;
  const txns = txnQ.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Банка и равнение" description="Импорт на банкови извлечения (CSV/XLSX) и равнение срещу вземания и задължения." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Импортирани транзакции" value={String(s?.totalTransactions ?? 0)} sub={s?.lastImportAt ? `Последен импорт: ${dateBG(s.lastImportAt)}` : 'Все още няма импорти'} icon={Landmark} tone="neutral" loading={summaryQ.isLoading} />
        <StatCard label="Неравнени" value={String(s?.unreconciled ?? 0)} sub="Чакат равнение" icon={AlertTriangle} tone={(s?.unreconciled ?? 0) > 0 ? 'warning' : 'neutral'} valueTone={(s?.unreconciled ?? 0) > 0 ? 'warning' : 'foreground'} loading={summaryQ.isLoading} />
        <StatCard label="Равнени" value={String(s?.reconciled ?? 0)} sub={`${s?.ignored ?? 0} игнорирани`} icon={CheckCircle2} tone="success" valueTone="success" loading={summaryQ.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AccountsCard companyId={companyId} />
        <ImportCard companyId={companyId} onImported={invalidate} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Транзакции</CardTitle>
          <Segmented<StatusFilter> value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
        <CardContent className="p-0">
          {txnQ.isLoading ? <TableSkeleton rows={6} cols={6} />
            : txnQ.isError ? <div className="p-5"><ErrorState onRetry={() => txnQ.refetch()} /></div>
            : txns.length === 0 ? <EmptyState icon={Banknote} title="Няма транзакции" description={status === 'all' ? 'Импортирайте банково извлечение, за да започнете равнение.' : 'Няма транзакции с този статус.'} />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead className="num">Сума</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Действие</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{dateBG(t.bookingDate)}</TableCell>
                      <TableCell className="max-w-[18rem] truncate font-medium text-foreground">{t.description ?? t.reference ?? '—'}</TableCell>
                      <TableCell className="max-w-[14rem] truncate text-muted-foreground">{t.counterpartyName ?? '—'}</TableCell>
                      <TableCell className="num"><Money value={signedAmount(t)} signed strong /></TableCell>
                      <TableCell><Badge variant={STATUS_BADGE[t.reconciliationStatus]?.variant ?? 'neutral'} dot>{STATUS_BADGE[t.reconciliationStatus]?.label ?? t.reconciliationStatus}</Badge></TableCell>
                      <TableCell className="text-right">
                        {t.reconciliationStatus === 'unreconciled'
                          ? <Button size="sm" variant="outline" onClick={() => setReconcileTxn(t)}><Link2 /> Равни</Button>
                          : <span className="t-caption">{t.reconciliationStatus === 'reconciled' ? 'Плащане създадено' : '—'}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <ReconcileDialog txn={reconcileTxn} onOpenChange={(v) => !v && setReconcileTxn(null)} onDone={invalidate} />
    </div>
  );
}

// ---- Accounts ----
function AccountsCard({ companyId }: { companyId?: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const q = useQuery({ queryKey: ['banking', 'accounts', companyId], queryFn: () => Endpoints.bankAccounts(), enabled: !!companyId });
  const setPrimary = useMutation({
    mutationFn: (id: string) => Endpoints.setPrimaryBankAccount(id),
    onSuccess: () => { toast.success('Основната сметка е зададена'); qc.invalidateQueries({ queryKey: ['banking', 'accounts'] }); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const accounts = q.data ?? [];
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>Банкови сметки</CardTitle>
          <CardDescription className="mt-1">IBAN сметки за импорт на извлечения.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus /> Добави</Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {q.isLoading ? <TableSkeleton rows={3} cols={3} />
          : accounts.length === 0 ? <EmptyState compact icon={Landmark} title="Няма сметки" description="Добавете банкова сметка, за да импортирате извлечения." />
          : (
            <ul className="divide-y divide-border border-t border-border">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <Landmark className="h-4 w-4 shrink-0 text-faint" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px] font-medium text-foreground">{a.iban}</p>
                    <p className="t-caption truncate">{a.bankName ?? '—'}{a.bic ? ` · ${a.bic}` : ''} · {a.currency}</p>
                  </div>
                  {a.isPrimary ? <Badge variant="success" dot>Основна</Badge>
                    : <Button size="sm" variant="ghost" onClick={() => setPrimary.mutate(a.id)} disabled={setPrimary.isPending}><Star /> Основна</Button>}
                </li>
              ))}
            </ul>
          )}
      </CardContent>
      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => qc.invalidateQueries({ queryKey: ['banking', 'accounts'] })} />
    </Card>
  );
}

function AddAccountDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [iban, setIban] = React.useState(''); const [bic, setBic] = React.useState(''); const [bankName, setBankName] = React.useState(''); const [currency, setCurrency] = React.useState('EUR');
  const create = useMutation({
    mutationFn: () => Endpoints.createBankAccount({ iban, bic: bic || undefined, bankName: bankName || undefined, currency }),
    onSuccess: () => { toast.success('Сметката е добавена'); onAdded(); onOpenChange(false); setIban(''); setBic(''); setBankName(''); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Нова банкова сметка</DialogTitle><DialogDescription>Първата добавена сметка става основна.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="acc-iban">IBAN</Label><Input id="acc-iban" className="font-mono" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="BG80BNBG96611020345678" autoComplete="off" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="acc-bic">BIC</Label><Input id="acc-bic" className="font-mono" value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BNBGBGSF" autoComplete="off" /></div>
            <div className="space-y-1.5"><Label htmlFor="acc-ccy">Валута</Label><Select id="acc-ccy" value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="EUR">EUR</option></Select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="acc-bank">Банка</Label><Input id="acc-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Име на банката" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отказ</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !iban.trim()}>{create.isPending ? <Loader2 className="animate-spin" /> : null} Добави</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Import ----
function ImportCard({ companyId, onImported }: { companyId?: string; onImported: () => void }) {
  const accountsQ = useQuery({ queryKey: ['banking', 'accounts', companyId], queryFn: () => Endpoints.bankAccounts(), enabled: !!companyId });
  const [accountId, setAccountId] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const accounts = accountsQ.data ?? [];
  React.useEffect(() => {
    const list = accountsQ.data ?? [];
    if (!accountId && list.length) setAccountId(list.find((a) => a.isPrimary)?.id ?? list[0].id);
  }, [accountsQ.data, accountId]);

  const imp = useMutation({
    mutationFn: () => Endpoints.importStatement(file!, accountId),
    onSuccess: (r) => { setReport(r); toast.success(`Импортирани ${r.importedCount} от ${r.rowCount} реда`); setFile(null); if (fileRef.current) fileRef.current.value = ''; onImported(); },
    onError: (e) => toast.error('Грешка при импорт', { description: e instanceof ApiError ? e.message : '' }),
  });

  const clearFile = () => { setFile(null); if (fileRef.current) fileRef.current.value = ''; };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Импорт на извлечение</CardTitle>
        <CardDescription>CSV или XLSX · колони: date, amount, currency, counterparty_name, reference…</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="imp-account">Сметка</Label>
          {accounts.length === 0
            ? <p className="text-[13px] text-muted-foreground">Първо добавете банкова сметка.</p>
            : <Select id="imp-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.iban} ({a.currency})</option>)}</Select>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="imp-file">Файл</Label>
          <label
            htmlFor="imp-file"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
              dragging ? 'border-brand bg-brand-soft/60' : 'border-border-strong bg-surface-2 hover:border-brand',
            )}
          >
            <Upload className="h-5 w-5 text-faint" strokeWidth={1.75} />
            {file ? (
              <span className="flex items-center gap-2 text-[13px]">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="max-w-[14rem] truncate font-medium text-foreground">{file.name}</span>
                <span className="t-caption">{bytes(file.size)}</span>
              </span>
            ) : (
              <>
                <span className="text-[13px] font-medium text-foreground">Пуснете файл тук или изберете</span>
                <span className="t-caption">CSV, XLSX или XLS</span>
              </>
            )}
            <input ref={fileRef} id="imp-file" type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => imp.mutate()} disabled={imp.isPending || !file || !accountId}>{imp.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Импортирай</Button>
          {file && <Button variant="ghost" size="sm" onClick={clearFile} disabled={imp.isPending}><X /> Премахни</Button>}
        </div>

        {report && (
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 font-medium text-foreground"><FileSpreadsheet className="h-4 w-4 shrink-0 text-faint" /> <span className="truncate">{report.fileName}</span></p>
              <Button variant="ghost" size="icon-sm" aria-label="Скрий отчета" onClick={() => setReport(null)}><X /></Button>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <ReportStat label="Редове" value={report.rowCount} />
              <ReportStat label="Импортирани" value={report.importedCount} tone="text-success" />
              <ReportStat label="Дубликати" value={report.duplicateCount} tone={report.duplicateCount > 0 ? 'text-warning' : undefined} />
              <ReportStat label="Грешки" value={report.errorCount} tone={report.errorCount > 0 ? 'text-destructive' : undefined} />
            </dl>
            {report.errors.length > 0 && (
              <ul className="mt-3 max-h-32 space-y-0.5 overflow-y-auto border-t border-border pt-2 text-xs text-destructive">
                {report.errors.slice(0, 20).map((er, i) => <li key={i}>Ред {er.row}{er.field ? ` · ${er.field}` : ''}: {er.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dt className="t-caption">{label}</dt>
      <dd className={cn('font-semibold tabular-nums text-foreground', tone)}>{value}</dd>
    </div>
  );
}

// ---- Reconcile dialog ----
function ReconcileDialog({ txn, onOpenChange, onDone }: { txn: BankTransaction | null; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const open = !!txn;
  const inbound = txn?.transactionType === 'inbound';
  const docType = inbound ? 'sales_invoice' : 'purchase_invoice';
  const [manualDoc, setManualDoc] = React.useState('');

  const suggQ = useQuery({ queryKey: ['banking', 'suggestions', txn?.id], queryFn: () => Endpoints.bankSuggestions(txn!.id), enabled: open });
  const openItemsQ = useQuery({ queryKey: ['arap', inbound ? 'ar' : 'ap', 'list-pick', txn?.id], queryFn: () => (inbound ? Endpoints.receivables() : Endpoints.payables()), enabled: open });

  const confirm = useMutation({
    mutationFn: (sug: MatchSuggestion) => Endpoints.bankConfirmMatch(txn!.id, { documentType: sug.documentType, documentId: sug.documentId, amount: sug.suggestedAmount, confidence: sug.confidence, reason: sug.reason }),
    onSuccess: () => { toast.success('Транзакцията е равнена и плащането е записано'); onDone(); onOpenChange(false); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const manual = useMutation({
    mutationFn: () => Endpoints.bankManualMatch(txn!.id, { documentType: docType, documentId: manualDoc }),
    onSuccess: () => { toast.success('Ръчното равнение е записано'); onDone(); onOpenChange(false); setManualDoc(''); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const reject = useMutation({
    mutationFn: () => Endpoints.bankRejectMatch(txn!.id, 'Няма съвпадение'),
    onSuccess: () => { toast.success('Транзакцията е игнорирана'); onDone(); onOpenChange(false); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const busy = confirm.isPending || manual.isPending || reject.isPending;
  const items: OpenItem[] = (openItemsQ.data as OpenItem[]) ?? [];
  const suggestions = suggQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Равнение на транзакция</DialogTitle>
          <DialogDescription>Изберете предложено съвпадение или равнете ръчно срещу {inbound ? 'вземане' : 'задължение'}.</DialogDescription>
        </DialogHeader>

        {txn && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">{txn.counterpartyName ?? txn.description ?? '—'}</p>
              <p className="t-caption truncate">{dateBG(txn.bookingDate)}{txn.reference ? ` · ${txn.reference}` : ''}</p>
            </div>
            <Money value={signedAmount(txn)} signed strong className="shrink-0 text-[15px]" />
          </div>
        )}

        <div className="space-y-5">
          <section className="space-y-2">
            <p className="t-overline">Предложени съвпадения</p>
            {suggQ.isLoading ? <p className="py-2 text-[13px] text-muted-foreground">Търсене…</p>
              : suggestions.length === 0 ? <Notice tone="neutral">Няма автоматични съвпадения. Използвайте ръчно равнение по-долу.</Notice>
              : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {suggestions.map((sug) => (
                    <li key={sug.documentId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                          <span className="truncate">{sug.documentRef ?? sug.documentId.slice(0, 8)} · {sug.counterpartyName ?? '—'}</span>
                          <ConfidenceBadge value={sug.confidence} />
                        </p>
                        <p className="t-caption truncate">{sug.reason} · остатък {eur(sug.outstanding)}</p>
                      </div>
                      <Money value={sug.suggestedAmount} strong className="shrink-0 text-[13px]" />
                      <Button size="sm" variant="success" disabled={busy} onClick={() => confirm.mutate(sug)}>
                        {confirm.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Потвърди
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="manual-doc" className="t-overline font-medium">Ръчно равнение</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select id="manual-doc" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)}>
                <option value="">Изберете {inbound ? 'фактура' : 'документ'}</option>
                {items.map((it) => <option key={it.documentId} value={it.documentId}>{it.documentRef ?? it.documentId.slice(0, 8)} · {it.counterpartyName ?? '—'} · {eur(it.outstanding)}</option>)}
              </Select>
              <Button variant="outline" className="shrink-0" disabled={busy || !manualDoc} onClick={() => manual.mutate()}>{manual.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Равни</Button>
            </div>
          </section>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => reject.mutate()}>Игнорирай транзакцията</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
