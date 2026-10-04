'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Landmark, ArrowRight } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { dateBG } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Dashboard banking widget: unreconciled count as the key figure + import/account context (Task 3.2). */
export function BankingWidget({ companyId }: { companyId?: string }) {
  const q = useQuery({ queryKey: ['banking', 'summary', companyId], queryFn: () => Endpoints.bankingSummary(), enabled: !!companyId });
  const s = q.data;
  const unreconciled = s?.unreconciled ?? 0;
  return (
    <Card>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="t-overline">Банка</p>
          <Landmark className="h-4 w-4 text-faint" strokeWidth={1.75} />
        </div>
        {q.isLoading ? (
          <Skeleton className="mt-3 h-7 w-24" />
        ) : (
          <p className={cn('mt-3 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em]', unreconciled > 0 ? 'text-warning' : 'text-foreground')}>{unreconciled}</p>
        )}
        <p className="mt-1.5 text-[13px] text-muted-foreground">неравнени транзакции</p>
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <p className="t-caption">
            <span className="tabular-nums text-foreground">{s?.totalTransactions ?? 0}</span> импортирани · <span className="tabular-nums text-foreground">{s?.reconciled ?? 0}</span> равнени · <span className="tabular-nums text-foreground">{s?.accountCount ?? 0}</span> сметки
          </p>
          <p className="t-caption">{s?.lastImportAt ? `Последен импорт: ${dateBG(s.lastImportAt)}` : 'Все още няма импорти'}</p>
        </div>
        <Link href="/banking" className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline">
          Виж всички <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
