'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, BadgeX, BadgeHelp, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/app/states';
import { dateBG } from '@/lib/format';

/**
 * VIES status for a counterparty: badge (Валиден / Невалиден / Непроверен) + last
 * validation date, with an optional "refresh validation" button. Reused on the
 * counterparties list and the invoice dialog (Task 4.2).
 */
export function ViesStatusBadge({ counterpartyId, showRefresh = false, showDate = true }: {
  counterpartyId: string;
  showRefresh?: boolean;
  showDate?: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['vies', 'status', counterpartyId],
    queryFn: () => Endpoints.viesStatus(counterpartyId),
    enabled: !!counterpartyId,
  });
  const refresh = useMutation({
    mutationFn: () => Endpoints.viesRefresh(counterpartyId),
    onSuccess: (r) => {
      toast[r.valid ? 'success' : 'warning'](r.valid ? 'ДДС номерът е валиден' : 'ДДС номерът е невалиден', { description: r.vatNumber });
      qc.invalidateQueries({ queryKey: ['vies', 'status', counterpartyId] });
    },
    onError: (e) => toast.error('Грешка при VIES проверка', { description: e instanceof ApiError ? e.message : '' }),
  });

  const s = q.data;
  const hasVat = !!s?.vatNumber;

  return (
    <span className="inline-flex items-center gap-2">
      {q.isLoading ? (
        <Badge variant="neutral"><Loader2 className="h-3 w-3 animate-spin" /> VIES</Badge>
      ) : !hasVat ? (
        <Badge variant="outline">Без ДДС №</Badge>
      ) : s?.status === 'valid' ? (
        <Badge variant="success"><BadgeCheck className="h-3 w-3" /> Валиден ДДС{s.stale ? ' (изтекъл)' : ''}</Badge>
      ) : s?.status === 'invalid' ? (
        <Badge variant="destructive"><BadgeX className="h-3 w-3" /> Невалиден ДДС</Badge>
      ) : (
        <Badge variant="warning"><BadgeHelp className="h-3 w-3" /> Непроверен</Badge>
      )}
      {showDate && s?.checkedAt && <span className="t-caption tabular-nums">{dateBG(s.checkedAt)}</span>}
      {showRefresh && hasVat && (
        <Button size="icon-sm" variant="ghost" title="Обнови VIES проверката" aria-label="Обнови VIES проверката" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          {refresh.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      )}
    </span>
  );
}

/** Inline warning shown in the invoice dialog when an EU customer's VAT is invalid. */
export function ViesInvoiceWarning({ counterpartyId }: { counterpartyId?: string }) {
  const q = useQuery({
    queryKey: ['vies', 'status', counterpartyId],
    queryFn: () => Endpoints.viesStatus(counterpartyId!),
    enabled: !!counterpartyId,
  });
  if (!counterpartyId || q.data?.status !== 'invalid') return null;
  return (
    <Notice tone="destructive" icon={AlertTriangle} title="Невалиден ДДС номер според VIES">
      Проверете данните на клиента преди издаване на фактура за ЕС.
    </Notice>
  );
}
