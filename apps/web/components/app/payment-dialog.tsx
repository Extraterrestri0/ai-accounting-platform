'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Undo2, Wallet, History } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Money } from '@/components/app/money';
import { AuditEntityHistory } from '@/components/app/audit/audit-entity-history';
import { dateBG, toNumber } from '@/lib/format';
import type { OpenItem, PaymentRow } from '@/lib/api/types';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record a payment against an AR/AP open item. Supports full + partial payments,
 * payment date / reference / notes, shows the payment history for the document and
 * allows reversing a prior payment. Never surfaces ledger journal entries.
 */
export function PaymentDialog({
  item, kind, onOpenChange, onSettled,
}: {
  item: OpenItem | null;
  kind: 'ar' | 'ap';
  onOpenChange: (v: boolean) => void;
  onSettled: () => void;
}) {
  const qc = useQueryClient();
  const open = !!item;
  const outstanding = toNumber(item?.outstanding);
  const counterpartyLabel = kind === 'ar' ? 'Клиент' : 'Доставчик';
  const verb = kind === 'ar' ? 'Отчети постъпление' : 'Отчети плащане';

  const [amount, setAmount] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState(today());
  const [reference, setReference] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [auditOpen, setAuditOpen] = React.useState<string | null>(null);

  // Prefill the amount with the full outstanding balance each time a new item opens.
  React.useEffect(() => {
    if (item) { setAmount(item.outstanding); setPaymentDate(today()); setReference(''); setNotes(''); }
  }, [item?.documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const historyQ = useQuery({
    queryKey: ['payments', item?.documentType, item?.documentId],
    queryFn: () => Endpoints.payments({ documentType: item!.documentType, documentId: item!.documentId }),
    enabled: open,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['arap'] });          // AR/AP lists, summaries, aging (pages + dashboard)
    qc.invalidateQueries({ queryKey: ['payments'] });      // payment history
    onSettled();
  };

  const record = useMutation({
    mutationFn: () => Endpoints.recordPayment({
      documentType: item!.documentType, documentId: item!.documentId,
      amount, paymentDate, currency: item!.currency,
      reference: reference || undefined, notes: notes || undefined,
    }),
    onSuccess: () => { toast.success('Плащането е отчетено'); refresh(); onOpenChange(false); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });

  const reverse = useMutation({
    mutationFn: (id: string) => Endpoints.reversePayment(id, 'Сторниране от потребител'),
    onSuccess: () => { toast.success('Плащането е сторнирано'); refresh(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });

  const amt = toNumber(amount);
  const invalid = !(amt > 0) || amt > outstanding + 0.005;
  const payments = historyQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{verb}</DialogTitle>
          <DialogDescription>
            {item?.documentRef ? `${item.documentRef} · ` : ''}{item?.counterpartyName ?? counterpartyLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Document settlement summary */}
        <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-surface-2">
          <div className="px-4 py-3"><dt className="t-overline">Общо</dt><dd className="mt-1 text-sm text-foreground"><Money value={item?.total} /></dd></div>
          <div className="px-4 py-3"><dt className="t-overline">Платено</dt><dd className="mt-1 text-sm text-foreground"><Money value={item?.paid} /></dd></div>
          <div className="px-4 py-3"><dt className="t-overline">Остатък</dt><dd className="mt-1 text-sm text-foreground"><Money value={item?.outstanding} strong /></dd></div>
        </dl>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount">Сума</Label>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setAmount(item?.outstanding ?? '')}>
                Пълно плащане
              </Button>
            </div>
            <Input id="pay-amount" inputMode="decimal" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={amt > outstanding + 0.005 || undefined} />
            {amt > outstanding + 0.005 && <p className="text-xs text-destructive">Сумата надвишава остатъка ({item?.outstanding}).</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Дата на плащане</Label>
              <Input id="pay-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Референция</Label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Банков документ №" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Бележки</Label>
            <Textarea id="pay-notes" className="min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="По избор" />
          </div>
        </div>

        {/* Payment history (supports multiple/partial payments + reversal) */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            <Label>Платежна история</Label>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Дата</TableHead>
                    <TableHead>Референция</TableHead>
                    <TableHead className="num">Сума</TableHead>
                    <TableHead className="text-right">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p: PaymentRow) => (
                    <React.Fragment key={p.id}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{dateBG(p.paymentDate)}</TableCell>
                        <TableCell className="max-w-[8rem] truncate text-muted-foreground">{p.reference ?? '—'}</TableCell>
                        <TableCell className="num"><Money value={p.amount} strong={p.status !== 'reversed'} className={p.status === 'reversed' ? 'text-muted-foreground line-through' : undefined} /></TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {p.status === 'reversed' ? (
                              <Badge variant="neutral">Сторнирано</Badge>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => reverse.mutate(p.id)} disabled={reverse.isPending} title="Сторнирай плащането">
                                {reverse.isPending && reverse.variables === p.id ? <Loader2 className="animate-spin" /> : <Undo2 />} Сторно
                              </Button>
                            )}
                            <Button size="icon-sm" variant="ghost" title="Одитна история" aria-label="Одитна история" aria-expanded={auditOpen === p.id} onClick={() => setAuditOpen((cur) => (cur === p.id ? null : p.id))}>
                              <History />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {auditOpen === p.id && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="h-auto bg-surface-2 px-4 py-3">
                            <AuditEntityHistory entityType="payment" entityId={p.id} enabled={open} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button>
          <Button variant="success" onClick={() => record.mutate()} disabled={record.isPending || invalid}>
            {record.isPending ? <Loader2 className="animate-spin" /> : <Wallet />} Отчети
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
