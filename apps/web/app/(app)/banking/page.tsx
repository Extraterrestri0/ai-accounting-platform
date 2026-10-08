'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark, Plus, Upload, Loader2, Star, CheckCircle2, Link2, Banknote, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DualMoney } from '@/components/app/money';
import { eur, dateBG } from '@/lib/format';
import type { BankAccount, BankTransaction, ImportReport, MatchSuggestion, OpenItem } from '@/lib/api/types';

const selectCls = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  unreconciled: { label: 'Неравнена', variant: 'warning' }, reconciled: { label: 'Равнена', variant: 'success' }, ignored: { label: 'Игнорирана', variant: 'neutral' },
};

export default function BankingPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [status, setStatus] = React.useState('unreconciled');
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
        <StatCard label="Импортирани транзакции" value={summaryQ.isLoading ? '…' : String(s?.totalTransactions ?? 0)} sub={s?.lastImportAt ? `Последен импорт: ${dateBG(s.lastImportAt)}` : undefined} icon={Landmark} tone="primary" />
        <StatCard label="Неравнени" value={summaryQ.isLoading ? '…' : String(s?.unreconciled ?? 0)} icon={AlertTriangle} tone="warning" valueTone={(s?.unreconciled ?? 0) > 0 ? 'warning' : 'foreground'} />
        <StatCard label="Равнени" value={summaryQ.isLoading ? '…' : String(s?.reconciled ?? 0)} icon={CheckCircle2} tone="success" valueTone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AccountsCard companyId={companyId} />
        <ImportCard companyId={companyId} onImported={invalidate} />
      </div>

      <Card>
        <CardHeader className="space-y-0"><CardTitle className="text-base">Транзакции</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList>
              <TabsTrigger value="unreconciled">Неравнени</TabsTrigger>
              <TabsTrigger value="reconciled">Равнени</TabsTrigger>
              <TabsTrigger value="ignored">Игнорирани</TabsTrigger>
              <TabsTrigger value="all">Всички</TabsTrigger>
            </TabsList>
          </Tabs>
          {txnQ.isLoading ? <TableSkeleton rows={6} cols={6} />
            : txnQ.isError ? <ErrorState onRetry={() => txnQ.refetch()} />
            : txns.length === 0 ? <EmptyState icon={Banknote} title="Няма транзакции" description="Импортирайте банково извлечение, за да започнете равнение." />
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Контрагент</TableHead><TableHead>Основание</TableHead><TableHead className="text-right">Сума</TableHead><TableHead>Статус</TableHead><TableHead className="text-right">Действие</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txns.map((t) => {
                    const inbound = t.transactionType === 'inbound';
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="tabular-nums text-muted-foreground">{dateBG(t.bookingDate)}</TableCell>
                        <TableCell>{t.counterpartyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="max-w-[14rem] truncate text-muted-foreground">{t.reference ?? t.description ?? '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${inbound ? 'text-success' : 'text-destructive'}`}>{inbound ? '+' : ''}{eur(t.amount)}</TableCell>
                        <TableCell><Badge variant={STATUS_BADGE[t.reconciliationStatus]?.variant ?? 'neutral'}>{STATUS_BADGE[t.reconciliationStatus]?.label ?? t.reconciliationStatus}</Badge></TableCell>
                        <TableCell className="text-right">
                          {t.reconciliationStatus === 'unreconciled'
                            ? <Button size="sm" variant="outline" onClick={() => setReconcileTxn(t)}><Link2 className="h-4 w-4" /> Равни</Button>
                            : <span className="text-xs text-muted-foreground">{t.reconciliationStatus === 'reconciled' ? 'плащане създадено' : '—'}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle className="text-base">Банкови сметки</CardTitle><CardDescription>IBAN сметки за импорт на извлечения.</CardDescription></div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Добави</Button>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? <div className="p-4"><TableSkeleton rows={3} cols={3} /></div>
          : accounts.length === 0 ? <div className="p-6"><EmptyState icon={Landmark} title="Няма сметки" description="Добавете банкова сметка, за да импортирате извлечения." /></div>
          : (
            <div className="divide-y">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-accent-foreground"><Landmark className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium text-foreground">{a.iban}</p>
                    <p className="text-xs text-muted-foreground">{a.bankName ?? '—'} · {a.currency}</p>
                  </div>
                  {a.isPrimary ? <Badge variant="success"><Star className="mr-1 h-3 w-3" /> Основна</Badge>
                    : <Button size="sm" variant="ghost" onClick={() => setPrimary.mutate(a.id)} disabled={setPrimary.isPending}><Star className="h-4 w-4" /> Основна</Button>}
                </div>
              ))}
            </div>
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
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>IBAN</Label><Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="BG80BNBG96611020345678" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>BIC</Label><Input value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BNBGBGSF" /></div>
            <div className="space-y-1.5"><Label>Валута</Label><select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}><option>EUR</option><option>BGN</option><option>USD</option></select></div>
          </div>
          <div className="space-y-1.5"><Label>Банка</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Име на банката" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отказ</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !iban.trim()}>{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Добави</Button>
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

  return (
    <Card>
      <CardHeader className="space-y-0"><CardTitle className="text-base">Импорт на извлечение</CardTitle><CardDescription>CSV или XLSX · колони: date, amount, currency, counterparty_name, reference…</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5"><Label>Сметка</Label>
          {accounts.length === 0 ? <p className="text-sm text-muted-foreground">Първо добавете банкова сметка.</p>
            : <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.iban} ({a.currency})</option>)}</select>}
        </div>
        <div className="space-y-1.5"><Label>Файл</Label><Input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <Button onClick={() => imp.mutate()} disabled={imp.isPending || !file || !accountId}>{imp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Импортирай</Button>

        {report && (
          <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground"><FileSpreadsheet className="h-4 w-4" /> {report.fileName}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>Редове: <b className="tabular-nums">{report.rowCount}</b></span>
              <span className="text-success">Импортирани: <b className="tabular-nums">{report.importedCount}</b></span>
              <span className="text-warning">Дубликати: <b className="tabular-nums">{report.duplicateCount}</b></span>
              <span className="text-destructive">Грешки: <b className="tabular-nums">{report.errorCount}</b></span>
            </div>
            {report.errors.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-destructive">
                {report.errors.slice(0, 20).map((er, i) => <li key={i}>Ред {er.row}{er.field ? ` · ${er.field}` : ''}: {er.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
  const confBadge = (c: number) => (c >= 0.9 ? 'success' : c >= 0.7 ? 'default' : 'warning') as 'success' | 'default' | 'warning';
  const items: OpenItem[] = (openItemsQ.data as OpenItem[]) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Равнение на транзакция</DialogTitle>
          <DialogDescription>
            {txn ? `${dateBG(txn.bookingDate)} · ${txn.counterpartyName ?? '—'} · ` : ''}
            <span className={inbound ? 'text-success' : 'text-destructive'}>{inbound ? '+' : ''}{txn ? eur(txn.amount) : ''}</span>
            {' '}→ {inbound ? 'вземания' : 'задължения'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Предложени съвпадения</Label>
            {suggQ.isLoading ? <p className="py-3 text-sm text-muted-foreground">Търсене…</p>
              : (suggQ.data?.length ?? 0) === 0 ? <p className="py-2 text-sm text-muted-foreground">Няма автоматични съвпадения. Използвайте ръчно равнение по-долу.</p>
              : (
                <div className="space-y-2">
                  {suggQ.data!.map((sug) => (
                    <div key={sug.documentId} className="flex items-center gap-3 rounded-lg border p-2.5">
                      <Badge variant={confBadge(sug.confidence)}>{Math.round(sug.confidence * 100)}%</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{sug.documentRef ?? sug.documentId.slice(0, 8)} · {sug.counterpartyName ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{sug.reason} · остатък {eur(sug.outstanding)}</p>
                      </div>
                      <Button size="sm" variant="success" disabled={busy} onClick={() => confirm.mutate(sug)}>
                        {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Потвърди
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="space-y-1.5 border-t pt-3">
            <Label>Ръчно равнение</Label>
            <div className="flex items-center gap-2">
              <select value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} className={selectCls}>
                <option value="">— избери {inbound ? 'фактура' : 'документ'} —</option>
                {items.map((it) => <option key={it.documentId} value={it.documentId}>{it.documentRef ?? it.documentId.slice(0, 8)} · {it.counterpartyName ?? '—'} · {eur(it.outstanding)}</option>)}
              </select>
              <Button size="sm" disabled={busy || !manualDoc} onClick={() => manual.mutate()}>{manual.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Равни</Button>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <Button variant="ghost" className="text-destructive" disabled={busy} onClick={() => reject.mutate()}>Игнорирай транзакцията</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
