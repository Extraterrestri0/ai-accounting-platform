'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { eur, dateBG } from '@/lib/format';

export default function PostingPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [from, setFrom] = React.useState('2026-01-01');
  const [to, setTo] = React.useState('2026-12-31');

  const q = useQuery({ queryKey: ['journal', companyId, from, to], queryFn: () => Endpoints.journalReport(from, to).catch(() => []), enabled: !!companyId });
  const entries = q.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Осчетоводяване"
        description="Неизменяема главна книга — всеки запис е балансиран и с одитна следа."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        }
      />

      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">
        <ShieldCheck className="h-4 w-4" /> Записите са само за добавяне — корекции се правят само със сторниращи записи.
      </div>

      {q.isLoading ? (
        <Card><CardContent className="p-4"><TableSkeleton rows={5} cols={3} /></CardContent></Card>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : entries.length === 0 ? (
        <Card><CardContent className="p-6"><EmptyState icon={BookOpenCheck} title="Няма осчетоводени записи" description="Одобрете и осчетоводете документ от „Преглед“, за да се появи тук." /></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e: any) => {
            const totalDr = (e.lines ?? []).filter((l: any) => l.direction === 'debit').reduce((s: number, l: any) => s + Number(l.amount), 0);
            return (
              <Card key={e.entryNo}>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Запис №{e.entryNo} · {e.description ?? 'Журнал'}</p>
                      <p className="text-xs text-muted-foreground">{dateBG(e.date)} · източник: {e.sourceType ?? '—'}</p>
                    </div>
                    <Badge variant="success">Осчетоводен</Badge>
                  </div>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <tbody>
                        {(e.lines ?? []).map((l: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{l.accountCode}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{l.direction === 'debit' ? eur(l.amount) : ''}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{l.direction === 'credit' ? eur(l.amount) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-right text-xs text-muted-foreground">Сума на записа: <span className="font-medium tabular-nums text-foreground">{eur(totalDr)}</span></p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
