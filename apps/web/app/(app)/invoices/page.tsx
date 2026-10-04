'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSpreadsheet, Plus, Send, Loader2, Trash2, FilePlus2, FileMinus2, ArrowRightLeft, Link2, History, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Money } from '@/components/app/money';
import { AuditHistoryDialog } from '@/components/app/audit/audit-history-dialog';
import { ViesInvoiceWarning } from '@/components/app/vies-status';
import { dateBG } from '@/lib/format';

interface LineForm { description: string; quantity: string; unitPrice: string; vatRate: string; vatCodeId?: string; catalogItemId?: string }

type KindFilter = 'all' | 'invoice' | 'proforma' | 'credit_note' | 'debit_note';
type StatusFilter = 'all' | 'draft' | 'issued';

const KIND_LABEL: Record<string, string> = { invoice: 'Фактура', credit_note: 'Кредитно известие', debit_note: 'Дебитно известие', proforma: 'Проформа' };
const KIND_VARIANT: Record<string, 'default' | 'destructive' | 'warning' | 'neutral'> = { invoice: 'default', credit_note: 'destructive', debit_note: 'warning', proforma: 'neutral' };
const PAGE_SIZE = 25;

export default function InvoicesPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const [relatedFor, setRelatedFor] = React.useState<string | null>(null);
  const [auditFor, setAuditFor] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [kind, setKind] = React.useState<KindFilter>('all');
  const [status, setStatus] = React.useState<StatusFilter>('all');
  const [page, setPage] = React.useState(1);

  const listQ = useQuery({ queryKey: ['invoices', companyId], queryFn: () => Endpoints.invoices(), enabled: !!companyId });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['invoices'] });

  const issue = useMutation({
    mutationFn: (id: string) => Endpoints.issueInvoice(id),
    onSuccess: (r: any) => { toast.success('Документът е издаден', { description: `№ ${r?.invoice?.invoiceNumber ?? ''}` }); invalidate(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const note = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'credit' | 'debit' }) => (kind === 'credit' ? Endpoints.createCreditNote(id) : Endpoints.createDebitNote(id)),
    onSuccess: (_r, v) => { toast.success(v.kind === 'credit' ? 'Кредитното известие е създадено (чернова)' : 'Дебитното известие е създадено (чернова)'); invalidate(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const convert = useMutation({
    mutationFn: (id: string) => Endpoints.convertToInvoice(id),
    onSuccess: () => { toast.success('Създадена е фактура от проформата (чернова)'); invalidate(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const busy = issue.isPending || note.isPending || convert.isPending;

  const invoices = React.useMemo<any[]>(() => listQ.data ?? [], [listQ.data]);

  // Client-side filtering only (the list endpoint is unchanged).
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) =>
      (kind === 'all' || inv.documentKind === kind)
      && (status === 'all' || inv.status === status)
      && (!q || String(inv.invoiceNumber ?? '').toLowerCase().includes(q) || String(inv.customerName ?? '').toLowerCase().includes(q)),
    );
  }, [invoices, search, kind, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const resetPage = () => setPage(1);

  const counts = React.useMemo(() => ({
    all: invoices.length,
    draft: invoices.filter((i) => i.status === 'draft').length,
    issued: invoices.filter((i) => i.status === 'issued').length,
  }), [invoices]);

  const hasFilters = !!search || kind !== 'all' || status !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Фактури и известия"
        description="Фактури, кредитни и дебитни известия и проформи – номериране, PDF, осчетоводяване и ДДС."
        actions={<Button onClick={() => setOpen(true)}><Plus /> Нов документ</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={status}
              onChange={(v) => { setStatus(v); resetPage(); }}
              options={[
                { value: 'all', label: 'Всички', count: counts.all },
                { value: 'draft', label: 'Чернови', count: counts.draft },
                { value: 'issued', label: 'Издадени', count: counts.issued },
              ]}
            />
            <Select value={kind} onChange={(e) => { setKind(e.target.value as KindFilter); resetPage(); }} className="w-auto min-w-[11rem]" aria-label="Тип документ">
              <option value="all">Всички типове</option>
              <option value="invoice">Фактури</option>
              <option value="proforma">Проформи</option>
              <option value="credit_note">Кредитни известия</option>
              <option value="debit_note">Дебитни известия</option>
            </Select>
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" placeholder="Търси по номер или контрагент" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
          </div>
        </div>

        {listQ.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : listQ.isError ? (
          <div className="p-6"><ErrorState onRetry={() => listQ.refetch()} /></div>
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="Няма документи" description="Създайте първата си фактура или проформа." action={<Button onClick={() => setOpen(true)}><Plus /> Нов документ</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState compact icon={Search} title="Няма съвпадения" description="Променете търсенето или филтрите." action={hasFilters ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); setKind('all'); setStatus('all'); resetPage(); }}>Изчисти филтрите</Button> : undefined} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="num">Сума</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((inv: any) => {
                  const issued = inv.status === 'issued';
                  const isInvoiceLike = inv.documentKind === 'invoice' || inv.documentKind === 'debit_note';
                  const date = inv.issueDate ?? inv.createdAt;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{inv.invoiceNumber ?? <span className="text-muted-foreground">чернова</span>}</span>
                          <Badge variant={KIND_VARIANT[inv.documentKind] ?? 'neutral'}>{KIND_LABEL[inv.documentKind] ?? inv.documentKind}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate">{inv.customerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{date ? dateBG(date) : '—'}</TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                      <TableCell className="num"><Money value={inv.grossTotal} strong /></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {!issued && (
                            <Button size="sm" variant="success" onClick={() => issue.mutate(inv.id)} disabled={busy}>
                              {issue.isPending && issue.variables === inv.id ? <Loader2 className="animate-spin" /> : <Send />} Издай
                            </Button>
                          )}
                          {issued && isInvoiceLike && (
                            <>
                              <Button size="sm" variant="ghost" title="Кредитно известие" onClick={() => note.mutate({ id: inv.id, kind: 'credit' })} disabled={busy}><FileMinus2 /> Кредитно</Button>
                              <Button size="sm" variant="ghost" title="Дебитно известие" onClick={() => note.mutate({ id: inv.id, kind: 'debit' })} disabled={busy}><FilePlus2 /> Дебитно</Button>
                            </>
                          )}
                          {issued && inv.documentKind === 'proforma' && (
                            <Button size="sm" variant="ghost" title="Преобразувай във фактура" onClick={() => convert.mutate(inv.id)} disabled={busy}><ArrowRightLeft /> Към фактура</Button>
                          )}
                          <Button size="icon-sm" variant="ghost" title="Свързани документи" aria-label="Свързани документи" onClick={() => setRelatedFor(inv.id)}><Link2 /></Button>
                          <Button size="icon-sm" variant="ghost" title="Одитна история" aria-label="Одитна история" onClick={() => setAuditFor(inv.id)}><History /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > PAGE_SIZE && (
              <Pagination page={safePage} totalPages={totalPages} total={filtered.length} unit="документа" onChange={setPage} />
            )}
          </>
        )}
      </Card>

      <CreateInvoiceDialog open={open} onOpenChange={setOpen} onCreated={invalidate} />
      <RelatedDialog invoiceId={relatedFor} onOpenChange={(v) => !v && setRelatedFor(null)} />
      <AuditHistoryDialog entityType="invoice" entityId={auditFor} subtitle="Хронология на действията по този документ." onOpenChange={(v) => !v && setAuditFor(null)} />
    </div>
  );
}

function RelatedDialog({ invoiceId, onOpenChange }: { invoiceId: string | null; onOpenChange: (v: boolean) => void }) {
  const q = useQuery({ queryKey: ['related', invoiceId], queryFn: () => Endpoints.relatedDocuments(invoiceId!), enabled: !!invoiceId });
  const rows: any[] = q.data ? [q.data.document, ...(q.data.related ?? [])] : [];
  const REL: Record<string, string> = { self: 'този документ', source: 'източник', derived: 'производен' };
  return (
    <Dialog open={!!invoiceId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Свързани документи</DialogTitle><DialogDescription>Източник и производни документи (известия, преобразувания).</DialogDescription></DialogHeader>
        {q.isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : rows.length <= 1 ? (
          <EmptyState compact icon={Link2} title="Няма свързани документи" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Документ</TableHead>
                  <TableHead>Връзка</TableHead>
                  <TableHead className="num">Сума</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{d.invoiceNumber ?? 'чернова'}</span>
                        <Badge variant={KIND_VARIANT[d.documentKind] ?? 'neutral'}>{KIND_LABEL[d.documentKind] ?? d.documentKind}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{REL[d.relation] ?? d.relation}</TableCell>
                    <TableCell className="num"><Money value={d.grossTotal} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_VAT_RATES = ['20', '9', '0'];
const newLine = (): LineForm => ({ description: '', quantity: '1', unitPrice: '', vatRate: '20' });

function CreateInvoiceDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const cpQ = useQuery({ queryKey: ['counterparties'], queryFn: () => Endpoints.counterparties().catch(() => []), enabled: open });
  const vatQ = useQuery({ queryKey: ['vatCodes'], queryFn: () => Endpoints.vatCodes().catch(() => []), enabled: open });
  const catQ = useQuery({ queryKey: ['catalog', 'active'], queryFn: () => Endpoints.catalogItems({ activeOnly: true }).catch(() => []), enabled: open });
  const [documentKind, setDocumentKind] = React.useState<'invoice' | 'proforma'>('invoice');
  const [customerName, setCustomerName] = React.useState('');
  const [customerId, setCustomerId] = React.useState<string | undefined>();
  const [lines, setLines] = React.useState<LineForm[]>([newLine()]);

  React.useEffect(() => {
    if (open && cpQ.data && cpQ.data.length && !customerName) {
      setCustomerName(cpQ.data[0].name); setCustomerId(cpQ.data[0].id);
    }
  }, [open, cpQ.data, customerName]);

  const vatCodeId = (vatQ.data?.[0]?.id) as string | undefined;

  const create = useMutation({
    mutationFn: () => Endpoints.createInvoice({
      documentKind, customerId, customerName,
      lines: lines.filter((l) => l.description && l.unitPrice).map((l) => ({
        description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
        vatRate: l.vatRate, vatCodeId, catalogItemId: l.catalogItemId,
      })),
    }),
    onSuccess: () => { toast.success('Черновата е създадена'); onCreated(); onOpenChange(false); reset(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });

  const reset = () => { setDocumentKind('invoice'); setLines([newLine()]); setCustomerName(''); setCustomerId(undefined); };
  const setLine = (i: number, patch: Partial<LineForm>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const catalog = (catQ.data as any[] | undefined) ?? [];
  const pickCatalog = (i: number, id: string) => {
    const ci = catalog.find((x) => x.id === id);
    if (!ci) { setLine(i, { catalogItemId: undefined }); return; }            // free-text fallback
    setLine(i, { catalogItemId: ci.id, description: ci.description, vatRate: String(Number(ci.vatRate)) });
  };

  // VAT % options: distinct rates from the company's VAT codes, falling back to the standard BG set.
  const vatRateOptions = React.useMemo(() => {
    const valid = (r: unknown) => Number.isFinite(Number(r)) && String(r).trim() !== '';
    const fromCodes = ((vatQ.data ?? []) as any[]).map((v) => v.rate).filter(valid).map((r) => String(Number(r)));
    const set = new Set<string>(fromCodes.length ? fromCodes : DEFAULT_VAT_RATES);
    lines.forEach((l) => { if (valid(l.vatRate)) set.add(String(Number(l.vatRate))); });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [vatQ.data, lines]);

  const net = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const vat = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (Number(l.vatRate) || 0) / 100, 0);
  const lineTotal = (l: LineForm) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Нов документ</DialogTitle>
          <DialogDescription>
            {documentKind === 'proforma'
              ? 'Проформата не се осчетоводява и не влиза в ДДС регистрите. Може да я преобразувате във фактура по-късно.'
              : 'Добавете клиент и редове. Издаването генерира номер, PDF и осчетоводяване.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-kind">Тип документ</Label>
              <Select id="inv-kind" value={documentKind} onChange={(e) => setDocumentKind(e.target.value as 'invoice' | 'proforma')}>
                <option value="invoice">Фактура</option>
                <option value="proforma">Проформа</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-customer">Клиент</Label>
              {cpQ.data && cpQ.data.length > 0 ? (
                <Select id="inv-customer" value={customerId ?? ''} onChange={(e) => { const c = cpQ.data!.find((x: any) => x.id === e.target.value); setCustomerId(c?.id); setCustomerName(c?.name ?? ''); }}>
                  {cpQ.data.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              ) : (
                <Input id="inv-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Име на клиент" />
              )}
            </div>
          </div>
          <ViesInvoiceWarning counterpartyId={customerId} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Редове</Label>
              <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine()])}><Plus /> Добави ред</Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {catalog.length > 0 && <TableHead className="min-w-[11rem]">Артикул</TableHead>}
                    <TableHead className="min-w-[12rem]">Описание</TableHead>
                    <TableHead className="num w-20">Кол.</TableHead>
                    <TableHead className="num w-28">Ед. цена</TableHead>
                    <TableHead className="w-24">ДДС %</TableHead>
                    <TableHead className="num w-28">Основа</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {catalog.length > 0 && (
                        <TableCell className="py-1.5">
                          <Select value={l.catalogItemId ?? ''} onChange={(e) => pickCatalog(i, e.target.value)} aria-label="Артикул от каталога" className="[&>select]:h-8 [&>select]:text-[13px]">
                            <option value="">Ръчно описание</option>
                            {catalog.map((ci) => <option key={ci.id} value={ci.id}>{ci.code} · {ci.description} ({Number(ci.vatRate).toFixed(0)}%)</option>)}
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="py-1.5">
                        <Input className="h-8 text-[13px]" placeholder="Описание" aria-label="Описание" value={l.description} onChange={(e) => setLine(i, { description: e.target.value, catalogItemId: undefined })} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input className="h-8 text-right text-[13px] tabular-nums" inputMode="decimal" placeholder="1" aria-label="Количество" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input className="h-8 text-right text-[13px] tabular-nums" inputMode="decimal" placeholder="0.00" aria-label="Единична цена" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Select value={l.vatRate} onChange={(e) => setLine(i, { vatRate: e.target.value })} aria-label="ДДС ставка" className="[&>select]:h-8 [&>select]:text-[13px]">
                          {vatRateOptions.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </Select>
                      </TableCell>
                      <TableCell className="num py-1.5 text-muted-foreground"><Money value={lineTotal(l)} /></TableCell>
                      <TableCell className="py-1.5 pr-2">
                        <Button variant="ghost" size="icon-sm" aria-label="Премахни реда" title="Премахни реда" onClick={() => removeLine(i)} disabled={lines.length === 1}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-6"><dt className="text-muted-foreground">Основа</dt><dd><Money value={net} /></dd></div>
              <div className="flex items-center justify-between gap-6"><dt className="text-muted-foreground">ДДС</dt><dd><Money value={vat} /></dd></div>
              <div className="flex items-center justify-between gap-6 border-t border-border pt-2"><dt className="font-medium text-foreground">Общо</dt><dd><Money value={net + vat} strong /></dd></div>
            </dl>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отказ</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !customerName || net <= 0}>
            {create.isPending ? <Loader2 className="animate-spin" /> : null} Създай чернова
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
