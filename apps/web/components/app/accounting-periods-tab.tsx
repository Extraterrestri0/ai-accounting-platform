'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, LockOpen, Loader2, CalendarClock } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { dateTimeBG } from '@/lib/format';
import type { AccountingPeriod } from '@/lib/api/types';

const MONTHS_BG = ['', 'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
export const periodLabel = (p: { month: number; year: number }) => `${MONTHS_BG[p.month] ?? p.month} ${p.year}`;

/** Settings → Accounting Periods: lock/open monthly periods (Task 4.3). */
export function AccountingPeriodsTab() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['periods', companyId], queryFn: () => Endpoints.periods(12), enabled: !!companyId });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['periods'] });
    qc.invalidateQueries({ queryKey: ['period', 'current'] });
  };

  const lock = useMutation({
    mutationFn: (p: AccountingPeriod) => Endpoints.lockPeriod(p.year, p.month),
    onSuccess: (_r, p) => { toast.success(`Период ${periodLabel(p)} е заключен`); invalidate(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const open = useMutation({
    mutationFn: (p: AccountingPeriod) => Endpoints.openPeriod(p.year, p.month),
    onSuccess: (_r, p) => { toast.success(`Период ${periodLabel(p)} е отворен`); invalidate(); },
    onError: (e) => toast.error('Грешка', { description: e instanceof ApiError ? e.message : '' }),
  });
  const busy = lock.isPending || open.isPending;
  const periods = q.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Счетоводни периоди</CardTitle>
        <CardDescription>Заключете приключен месец, за да спрете осчетоводявания, плащания, сторнирания, ДДС преизчисления и фактури в него.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : q.isError ? (
          <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
        ) : periods.length === 0 ? (
          <EmptyState compact icon={CalendarClock} title="Няма периоди" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Период</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Заключен от</TableHead>
                <TableHead className="w-32 text-right"><span className="sr-only">Действие</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow key={p.key}>
                  <TableCell className="font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {periodLabel(p)}
                      {p.isCurrent && <Badge variant="brand">текущ</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.status === 'locked'
                      ? <Badge variant="neutral" dot>Заключен</Badge>
                      : <Badge variant="success" dot>Отворен</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.status === 'locked' && p.lockedByEmail ? (
                      <span>{p.lockedByEmail}{p.lockedAt ? <span className="tabular-nums"> · {dateTimeBG(p.lockedAt)}</span> : null}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === 'locked' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => open.mutate(p)}>
                        {open.isPending ? <Loader2 className="animate-spin" /> : <LockOpen />} Отвори
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => lock.mutate(p)}>
                        {lock.isPending ? <Loader2 className="animate-spin" /> : <Lock />} Заключи
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
