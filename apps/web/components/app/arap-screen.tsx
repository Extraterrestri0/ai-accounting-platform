'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Wallet, Inbox } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { AgingTable } from '@/components/app/aging-table';
import { PaymentDialog } from '@/components/app/payment-dialog';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DualMoney } from '@/components/app/money';
import { dateBG, eur } from '@/lib/format';
import type { OpenItem } from '@/lib/api/types';

interface ArApConfig {
  kind: 'ar' | 'ap';
  title: string;
  description: string;
  counterpartyLabel: string;
  documentLabel: string;
  icon: typeof ArrowDownCircle;
  emptyTitle: string;
  emptyDesc: string;
  agingTitle: string;
}

const CONFIG: Record<'ar' | 'ap', ArApConfig> = {
  ar: {
    kind: 'ar', title: 'Вземания', description: 'Неплатени фактури към клиенти — падеж, просрочие и остатък за събиране.',
    counterpartyLabel: 'Клиент', documentLabel: 'Фактура', icon: ArrowDownCircle,
    emptyTitle: 'Няма открити вземания', emptyDesc: 'Всички издадени фактури са платени или все още няма издадени фактури.',
    agingTitle: 'Падежен анализ на вземанията',
  },
  ap: {
    kind: 'ap', title: 'Задължения', description: 'Неплатени документи към доставчици — падеж, просрочие и остатък за плащане.',
    counterpartyLabel: 'Доставчик', documentLabel: 'Документ', icon: ArrowUpCircle,
    emptyTitle: 'Няма открити задължения', emptyDesc: 'Всички осчетоводени покупки са платени или все още няма осчетоводени покупки.',
    agingTitle: 'Падежен анализ на задълженията',
  },
};

export function ArApScreen({ kind }: { kind: 'ar' | 'ap' }) {
  const cfg = CONFIG[kind];
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [payItem, setPayItem] = React.useState<OpenItem | null>(null);

  const api = kind === 'ar'
    ? { list: Endpoints.receivables, summary: Endpoints.receivablesSummary, aging: Endpoints.receivablesAging }
    : { list: Endpoints.payables, summary: Endpoints.payablesSummary, aging: Endpoints.payablesAging };

  const listQ = useQuery({ queryKey: ['arap', kind, 'list', companyId], queryFn: () => api.list(), enabled: !!companyId });
  const sumQ = useQuery({ queryKey: ['arap', kind, 'summary', companyId], queryFn: () => api.summary(), enabled: !!companyId });
  const agingQ = useQuery({ queryKey: ['arap', kind, 'aging', companyId], queryFn: () => api.aging(), enabled: !!companyId });

  const items = listQ.data ?? [];
  const s = sumQ.data;

  return (
    <div className="space-y-6">
      <PageHeader title={cfg.title} description={cfg.description} />

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Общо открито" value={sumQ.isLoading ? '…' : eur(s?.total ?? 0)} sub={s ? `${s.count} документа` : undefined} icon={cfg.icon} tone="primary" valueTone="primary" />
        <StatCard label="Текущо" value={sumQ.isLoading ? '…' : eur(s?.current ?? 0)} icon={Wallet} tone="neutral" />
        <StatCard label="Просрочено" value={sumQ.isLoading ? '…' : eur(s?.overdue ?? 0)} sub={s ? `${s.overdueCount} документа` : undefined} icon={Inbox} tone="warning" valueTone={s && Number(s.overdue) > 0 ? 'warning' : 'foreground'} />
      </div>

      {/* Aging report */}
      <AgingTable
        title={cfg.agingTitle}
        report={agingQ.data}
        isLoading={agingQ.isLoading}
        isError={agingQ.isError}
        onRetry={() => agingQ.refetch()}
      />

      {/* Open items */}
      <Card>
        {listQ.isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={7} /></div>
        ) : listQ.isError ? (
          <div className="p-6"><ErrorState onRetry={() => listQ.refetch()} /></div>
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState icon={cfg.icon} title={cfg.emptyTitle} description={cfg.emptyDesc} /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{cfg.documentLabel}</TableHead>
                <TableHead>{cfg.counterpartyLabel}</TableHead>
                <TableHead>Падеж</TableHead>
                <TableHead className="text-right">Просрочие</TableHead>
                <TableHead className="text-right">Остатък</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={`${it.documentType}:${it.documentId}`}>
                  <TableCell className="font-medium text-foreground">{it.documentRef ?? '—'}</TableCell>
                  <TableCell>{it.counterpartyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{it.dueDate ? dateBG(it.dueDate) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.overdueDays > 0 ? <span className="text-destructive">{it.overdueDays} дни</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right"><DualMoney value={it.outstanding} strong /></TableCell>
                  <TableCell><OpenItemStatus item={it} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setPayItem(it)}>
                      <Wallet className="h-4 w-4" /> Плащане
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <PaymentDialog item={payItem} kind={kind} onOpenChange={(v) => !v && setPayItem(null)} onSettled={() => { /* queries share the ['arap'] key and revalidate */ }} />
    </div>
  );
}

/** Status chip derived from settlement + due state (no ledger details exposed). */
function OpenItemStatus({ item }: { item: OpenItem }) {
  const partial = Number(item.paid) > 0;
  if (item.overdueDays > 0) {
    return (
      <span className="flex items-center gap-1">
        <Badge variant="destructive">Просрочено</Badge>
        {partial && <Badge variant="warning">частично</Badge>}
      </span>
    );
  }
  return partial ? <Badge variant="warning">Частично платено</Badge> : <Badge variant="neutral">Текущо</Badge>;
}
