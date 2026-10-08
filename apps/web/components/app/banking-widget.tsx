'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Landmark, ArrowRight } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dateBG } from '@/lib/format';

/** Dashboard banking widget: imported / unreconciled / reconciled + last import (Task 3.2). */
export function BankingWidget({ companyId }: { companyId?: string }) {
  const q = useQuery({ queryKey: ['banking', 'summary', companyId], queryFn: () => Endpoints.bankingSummary(), enabled: !!companyId });
  const s = q.data;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4 text-primary" /> Банка</CardTitle>
        <Button variant="outline" size="sm" asChild><Link href="/banking">Виж всички <ArrowRight className="h-4 w-4" /></Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Импортирани" value={s?.totalTransactions ?? 0} tone="text-foreground" />
              <Stat label="Неравнени" value={s?.unreconciled ?? 0} tone={(s?.unreconciled ?? 0) > 0 ? 'text-warning' : 'text-foreground'} />
              <Stat label="Равнени" value={s?.reconciled ?? 0} tone="text-success" />
            </div>
            <p className="text-xs text-muted-foreground">
              {s?.lastImportAt ? `Последен импорт: ${dateBG(s.lastImportAt)}` : 'Все още няма импорти'} · {s?.accountCount ?? 0} сметки
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
