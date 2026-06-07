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
import { DualMoney } from '@/components/app/money';
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
  const verb = kind === 'ar' ? 'Отчети плащане' : 'Отчети плащане';

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
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> {verb}</DialogTitle>
          <DialogDescription>
            {item?.documentRef ? `${item.documentRef} · ` : ''}{item?.counterpartyName ?? counterpartyLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Document settlement summary */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-secondary/60 px-4 py-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Общо</dt><dd className="font-medium text-foreground"><DualMoney value={item?.total} dual={false} /></dd></div>
          <div><dt className="text-xs text-muted-foreground">Платено</dt><dd className="font-medium text-foreground"><DualMoney value={item?.paid} dual={false} /></dd></div>
          <div><dt className="text-xs text-muted-foreground">Остатък</dt><dd className="font-semibold text-foreground"><DualMoney value={item?.outstanding} dual={false} /></dd></div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount">Сума</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setAmount(item?.outstanding ?? '')}>
                Пълно плащане
              </button>
            </div>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
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
            <Input id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="По избор" />
          </div>
        </div>

        {/* Payment history (supports multiple/partial payments + reversal) */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            <Label>Платежна история</Label>
            <div className="divide-y rounded-lg border">
              {payments.map((p: PaymentRow) => (
                <div key={p.id}>
                  <div className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="tabular-nums text-muted-foreground">{dateBG(p.paymentDate)}</span>
                    <span className="flex-1"><DualMoney value={p.amount} dual={false} /></span>
                    {p.reference && <span className="max-w-[8rem] truncate text-xs text-muted-foreground">{p.reference}</span>}
                    <Button size="icon" variant="ghost" title="Одитна история" onClick={() => setAuditOpen((cur) => (cur === p.id ? null : p.id))}>
                      <History className="h-4 w-4" />
                    </Button>
                    {p.status === 'reversed' ? (
                      <Badge variant="neutral">Сторнирано</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => reverse.mutate(p.id)} disabled={reverse.isPending} title="Сторнирай плащането">
                        {reverse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Сторно
                      </Button>
                    )}
                  </div>
                  {auditOpen === p.id && (
                    <div className="border-t bg-secondary/30 px-3 py-3">
                      <AuditEntityHistory entityType="payment" entityId={p.id} enabled={open} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Затвори</Button>
          <Button onClick={() => record.mutate()} disabled={record.isPending || invalid}>
            {record.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Отчети
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
