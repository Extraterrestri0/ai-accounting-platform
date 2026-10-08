'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DualMoney } from '@/components/app/money';
import { Skeleton } from '@/components/ui/skeleton';
import { eur } from '@/lib/format';
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
  ar: { kind: 'ar', title: 'Вземания', href: '/receivables', icon: ArrowDownCircle, counterpartyLabel: 'клиенти', topLabel: 'Топ просрочени клиенти', emptyLabel: 'Няма просрочени вземания' },
  ap: { kind: 'ap', title: 'Задължения', href: '/payables', icon: ArrowUpCircle, counterpartyLabel: 'доставчици', topLabel: 'Топ просрочени доставчици', emptyLabel: 'Няма просрочени задължения' },
};

function ArApWidget({ companyId, cfg }: { companyId?: string; cfg: WidgetCfg }) {
  const api = cfg.kind === 'ar'
    ? { list: Endpoints.receivables, summary: Endpoints.receivablesSummary }
    : { list: Endpoints.payables, summary: Endpoints.payablesSummary };
  const sumQ = useQuery({ queryKey: ['arap', cfg.kind, 'summary', companyId], queryFn: () => api.summary(), enabled: !!companyId });
  const listQ = useQuery({ queryKey: ['arap', cfg.kind, 'list', companyId], queryFn: () => api.list(), enabled: !!companyId });
  const s = sumQ.data;

  const topOverdue = ((listQ.data ?? []) as OpenItem[])
    .filter((i) => i.overdueDays > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <cfg.icon className="h-4 w-4 text-primary" /> {cfg.title}
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={cfg.href}>Виж всички <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {sumQ.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Общо" value={eur(s?.total ?? 0)} tone="text-foreground" />
            <Stat label="Текущо" value={eur(s?.current ?? 0)} tone="text-foreground" />
            <Stat label="Просрочено" value={eur(s?.overdue ?? 0)} tone={s && Number(s.overdue) > 0 ? 'text-warning' : 'text-foreground'}
              sub={s ? `${s.overdueCount} док.` : undefined} />
          </div>
        )}

        <div>
          <p className="t-overline mb-1.5">{cfg.topLabel}</p>
          {listQ.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : topOverdue.length === 0 ? (
            <p className="flex items-center gap-1.5 py-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> {cfg.emptyLabel}</p>
          ) : (
            <ul className="divide-y">
              {topOverdue.map((it) => (
                <li key={`${it.documentType}:${it.documentId}`} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{it.counterpartyName ?? it.documentRef ?? '—'}</span>
                  <span className="shrink-0 text-xs text-destructive tabular-nums">{it.overdueDays} дни</span>
                  <span className="shrink-0"><DualMoney value={it.outstanding} dual={false} strong /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ReceivablesWidget({ companyId }: { companyId?: string }) {
  return <ArApWidget companyId={companyId} cfg={CFG.ar} />;
}
export function PayablesWidget({ companyId }: { companyId?: string }) {
  return <ArApWidget companyId={companyId} cfg={CFG.ap} />;
}
