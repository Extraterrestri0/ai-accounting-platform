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
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Счетоводни периоди</CardTitle>
        <CardDescription>Заключете приключен месец, за да предотвратите осчетоводявания, плащания, сторнирания, ДДС преизчисления и фактури в него.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={4} /></div>
        ) : q.isError ? (
          <div className="p-6"><ErrorState onRetry={() => q.refetch()} /></div>
        ) : periods.length === 0 ? (
          <div className="p-6"><EmptyState icon={CalendarClock} title="Няма периоди" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Период</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Заключен от</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow key={p.key}>
                  <TableCell className="font-medium text-foreground">
                    {periodLabel(p)} {p.isCurrent && <Badge variant="neutral" className="ml-1">текущ</Badge>}
                  </TableCell>
                  <TableCell>
                    {p.status === 'locked'
                      ? <Badge variant="destructive"><Lock className="mr-1 h-3 w-3" /> Заключен</Badge>
                      : <Badge variant="success"><LockOpen className="mr-1 h-3 w-3" /> Отворен</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.status === 'locked' && p.lockedByEmail ? (
                      <span>{p.lockedByEmail}{p.lockedAt ? ` · ${dateTimeBG(p.lockedAt)}` : ''}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === 'locked' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => open.mutate(p)}>
                        {open.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} Отвори
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => lock.mutate(p)}>
                        {lock.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Заключи
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
