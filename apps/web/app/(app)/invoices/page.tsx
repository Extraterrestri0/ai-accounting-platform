'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSpreadsheet, Plus, Send, Loader2, Trash2, CheckCircle2, FilePlus2, FileMinus2, ArrowRightLeft, Link2, History } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DualMoney } from '@/components/app/money';
import { AuditHistoryDialog } from '@/components/app/audit/audit-history-dialog';
import { ViesInvoiceWarning } from '@/components/app/vies-status';
import { eur } from '@/lib/format';

interface LineForm { description: string; quantity: string; unitPrice: string; vatRate: string; vatCodeId?: string; catalogItemId?: string }

const KIND_LABEL: Record<string, string> = { invoice: 'Фактура', credit_note: 'Кредитно известие', debit_note: 'Дебитно известие', proforma: 'Проформа' };
const KIND_VARIANT: Record<string, 'default' | 'destructive' | 'warning' | 'neutral'> = { invoice: 'default', credit_note: 'destructive', debit_note: 'warning', proforma: 'neutral' };
const selectCls = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function InvoicesPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const [relatedFor, setRelatedFor] = React.useState<string | null>(null);
  const [auditFor, setAuditFor] = React.useState<string | null>(null);
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

  const invoices = listQ.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Фактури и известия"
        description="Фактури, кредитни и дебитни известия и проформи — номериране, PDF, осчетоводяване и ДДС."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Нов документ</Button>}
      />

      <Card>
        {listQ.isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={6} /></div>
        ) : listQ.isError ? (
          <div className="p-6"><ErrorState onRetry={() => listQ.refetch()} /></div>
        ) : invoices.length === 0 ? (
          <div className="p-6"><EmptyState icon={FileSpreadsheet} title="Няма документи" description="Създайте първата си фактура или проформа." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Нов документ</Button>} /></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Номер</TableHead><TableHead>Тип</TableHead><TableHead>Клиент</TableHead><TableHead>Статус</TableHead><TableHead className="text-right">Сума</TableHead><TableHead className="text-right">Действие</TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((inv: any) => {
                const issued = inv.status === 'issued';
                const isInvoiceLike = inv.documentKind === 'invoice' || inv.documentKind === 'debit_note';
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-foreground">{inv.invoiceNumber ?? <span className="text-muted-foreground">чернова</span>}</TableCell>
                    <TableCell><Badge variant={KIND_VARIANT[inv.documentKind] ?? 'neutral'}>{KIND_LABEL[inv.documentKind] ?? inv.documentKind}</Badge></TableCell>
                    <TableCell>{inv.customerName ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-right"><DualMoney value={inv.grossTotal} strong /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {!issued && (
                          <Button size="sm" variant="success" onClick={() => issue.mutate(inv.id)} disabled={busy}>
                            {issue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Издай
                          </Button>
                        )}
                        {issued && isInvoiceLike && (
                          <>
                            <Button size="sm" variant="ghost" title="Кредитно известие" onClick={() => note.mutate({ id: inv.id, kind: 'credit' })} disabled={busy}><FileMinus2 className="h-4 w-4" /> Кредитно</Button>
                            <Button size="sm" variant="ghost" title="Дебитно известие" onClick={() => note.mutate({ id: inv.id, kind: 'debit' })} disabled={busy}><FilePlus2 className="h-4 w-4" /> Дебитно</Button>
                          </>
                        )}
                        {issued && inv.documentKind === 'proforma' && (
                          <Button size="sm" variant="ghost" title="Преобразувай във фактура" onClick={() => convert.mutate(inv.id)} disabled={busy}><ArrowRightLeft className="h-4 w-4" /> Към фактура</Button>
                        )}
                        <Button size="icon" variant="ghost" title="Свързани документи" onClick={() => setRelatedFor(inv.id)}><Link2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Одитна история" onClick={() => setAuditFor(inv.id)}><History className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Зареждане…</div>
        ) : rows.length <= 1 ? (
          <p className="py-6 text-sm text-muted-foreground">Няма свързани документи.</p>
        ) : (
          <div className="divide-y">
            {rows.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <Badge variant={KIND_VARIANT[d.documentKind] ?? 'neutral'}>{KIND_LABEL[d.documentKind] ?? d.documentKind}</Badge>
                <span className="flex-1 text-sm font-medium text-foreground">{d.invoiceNumber ?? 'чернова'}</span>
                <span className="text-xs text-muted-foreground">{REL[d.relation]}</span>
                <DualMoney value={d.grossTotal} />
              </div>
            ))}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateInvoiceDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const cpQ = useQuery({ queryKey: ['counterparties'], queryFn: () => Endpoints.counterparties().catch(() => []), enabled: open });
  const vatQ = useQuery({ queryKey: ['vatCodes'], queryFn: () => Endpoints.vatCodes().catch(() => []), enabled: open });
  const catQ = useQuery({ queryKey: ['catalog', 'active'], queryFn: () => Endpoints.catalogItems({ activeOnly: true }).catch(() => []), enabled: open });
  const [documentKind, setDocumentKind] = React.useState<'invoice' | 'proforma'>('invoice');
  const [customerName, setCustomerName] = React.useState('');
  const [customerId, setCustomerId] = React.useState<string | undefined>();
  const [lines, setLines] = React.useState<LineForm[]>([{ description: '', quantity: '1', unitPrice: '', vatRate: '20' }]);

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

  const reset = () => { setDocumentKind('invoice'); setLines([{ description: '', quantity: '1', unitPrice: '', vatRate: '20' }]); setCustomerName(''); setCustomerId(undefined); };
  const setLine = (i: number, patch: Partial<LineForm>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const catalog = (catQ.data as any[] | undefined) ?? [];
  const pickCatalog = (i: number, id: string) => {
    const ci = catalog.find((x) => x.id === id);
    if (!ci) { setLine(i, { catalogItemId: undefined }); return; }            // free-text fallback
    setLine(i, { catalogItemId: ci.id, description: ci.description, vatRate: String(ci.vatRate) });
  };

  const net = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const vat = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (Number(l.vatRate) || 0) / 100, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Нов документ</DialogTitle>
          <DialogDescription>{documentKind === 'proforma' ? 'Проформата не се осчетоводява и не влиза в ДДС регистрите. Може да я преобразувате във фактура по-късно.' : 'Добавете клиент и редове. Издаването генерира номер, PDF и осчетоводяване.'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Тип документ</Label>
              <select value={documentKind} onChange={(e) => setDocumentKind(e.target.value as 'invoice' | 'proforma')} className={selectCls}>
                <option value="invoice">Фактура</option>
                <option value="proforma">Проформа</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Клиент</Label>
            {cpQ.data && cpQ.data.length > 0 ? (
              <select value={customerId ?? ''} onChange={(e) => { const c = cpQ.data!.find((x: any) => x.id === e.target.value); setCustomerId(c?.id); setCustomerName(c?.name ?? ''); }}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {cpQ.data.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Име на клиент" />
            )}
            <ViesInvoiceWarning counterpartyId={customerId} />
          </div>

          <div className="space-y-2">
            <Label>Редове</Label>
            {lines.map((l, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-2">
                {catalog.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={l.catalogItemId ?? ''}
                      onChange={(e) => pickCatalog(i, e.target.value)}
                      className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">— ръчно описание —</option>
                      {catalog.map((ci) => <option key={ci.id} value={ci.id}>{ci.code} · {ci.description} ({Number(ci.vatRate).toFixed(0)}%)</option>)}
                    </select>
                    <Button variant="ghost" size="icon" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
                <div className="grid grid-cols-12 items-center gap-2">
                  <Input className="col-span-5" placeholder="Описание" value={l.description} onChange={(e) => setLine(i, { description: e.target.value, catalogItemId: undefined })} />
                  <Input className="col-span-2" placeholder="Кол." value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  <Input className="col-span-3" placeholder="Ед. цена" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                  <Input className="col-span-2" placeholder="ДДС %" value={l.vatRate} onChange={(e) => setLine(i, { vatRate: e.target.value })} />
                  {catalog.length === 0 && (
                    <Button variant="ghost" size="icon" className="col-span-12 justify-self-end" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { description: '', quantity: '1', unitPrice: '', vatRate: '20' }])}><Plus className="h-4 w-4" /> Добави ред</Button>
          </div>

          <div className="flex justify-end gap-6 rounded-lg bg-secondary/60 px-4 py-2 text-sm">
            <span className="text-muted-foreground">Основа: <span className="font-medium text-foreground tabular-nums">{eur(net)}</span></span>
            <span className="text-muted-foreground">ДДС: <span className="font-medium text-foreground tabular-nums">{eur(vat)}</span></span>
            <span className="text-muted-foreground">Общо: <DualMoney value={net + vat} strong className="text-foreground" /></span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отказ</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !customerName || net <= 0}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Създай чернова
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
