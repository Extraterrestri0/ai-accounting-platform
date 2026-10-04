'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/app/money';
import { Skeleton } from '@/components/ui/skeleton';
import { eur, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OpenItem } from '@/lib/api/types';

interface WidgetCfg {
  kind: 'ar' | 'ap';
  title: string;
  href: string;
  icon: typeof ArrowDownCircle;
  counterpartyLabel: string;
  topLabel: string;
  emptyLabel: string;
}

const CFG: Record<'ar' | 'ap', WidgetCfg> = {
  ar: { kind: 'ar', title: 'Вземания', href: '/receivables', icon: ArrowDownCircle, counterpartyLabel: 'клиенти', topLabel: 'Най-просрочени клиенти', emptyLabel: 'Няма просрочени вземания' },
  ap: { kind: 'ap', title: 'Задължения', href: '/payables', icon: ArrowUpCircle, counterpartyLabel: 'доставчици', topLabel: 'Най-просрочени доставчици', emptyLabel: 'Няма просрочени задължения' },
};

/** Compact dashboard card: title row, one big number, two secondary lines, top overdue list, link. */
function ArApWidget({ companyId, cfg }: { companyId?: string; cfg: WidgetCfg }) {
  const api = cfg.kind === 'ar'
    ? { list: Endpoints.receivables, summary: Endpoints.receivablesSummary }
    : { list: Endpoints.payables, summary: Endpoints.payablesSummary };
  const sumQ = useQuery({ queryKey: ['arap', cfg.kind, 'summary', companyId], queryFn: () => api.summary(), enabled: !!companyId });
  const listQ = useQuery({ queryKey: ['arap', cfg.kind, 'list', companyId], queryFn: () => api.list(), enabled: !!companyId });
  const s = sumQ.data;
  const overdue = toNumber(s?.overdue);

  const topOverdue = ((listQ.data ?? []) as OpenItem[])
    .filter((i) => i.overdueDays > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 3);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <cfg.icon className="h-4 w-4 text-brand" strokeWidth={1.75} /> {cfg.title}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="-mr-2 text-muted-foreground">
          <Link href={cfg.href}>Виж всички <ArrowRight /></Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {sumQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ) : (
          <div>
            <p className="text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-foreground">{eur(s?.total ?? 0)}</p>
            <dl className="mt-3 space-y-1 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Текущо</dt>
                <dd className="tabular-nums text-foreground">{eur(s?.current ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Просрочено{s ? <span className="text-faint"> · {s.overdueCount} док.</span> : null}</dt>
                <dd className={cn('tabular-nums', overdue > 0 ? 'font-medium text-warning' : 'text-foreground')}>{eur(s?.overdue ?? 0)}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-auto border-t border-border pt-3">
          <p className="t-overline mb-1.5">{cfg.topLabel}</p>
          {listQ.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : topOverdue.length === 0 ? (
            <p className="flex items-center gap-1.5 py-1.5 text-[13px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> {cfg.emptyLabel}</p>
          ) : (
            <ul className="divide-y divide-border">
              {topOverdue.map((it) => (
                <li key={`${it.documentType}:${it.documentId}`} className="flex items-center gap-3 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{it.counterpartyName ?? it.documentRef ?? '—'}</span>
                  <span className="shrink-0 tabular-nums text-destructive">{it.overdueDays} дни</span>
                  <span className="shrink-0 tabular-nums"><Money value={it.outstanding} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReceivablesWidget({ companyId }: { companyId?: string }) {
  return <ArApWidget companyId={companyId} cfg={CFG.ar} />;
}
export function PayablesWidget({ companyId }: { companyId?: string }) {
  return <ArApWidget companyId={companyId} cfg={CFG.ap} />;
}
