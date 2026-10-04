'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock, AlertTriangle, FileText, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { AgingTable } from '@/components/app/aging-table';
import { PaymentDialog } from '@/components/app/payment-dialog';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Money } from '@/components/app/money';
import { dateBG, eur, toNumber } from '@/lib/format';
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
  openTitle: string;
  openDesc: string;
}

const CONFIG: Record<'ar' | 'ap', ArApConfig> = {
  ar: {
    kind: 'ar', title: 'Вземания', description: 'Неплатени фактури към клиенти – падеж, просрочие и остатък за събиране.',
    counterpartyLabel: 'Клиент', documentLabel: 'Фактура', icon: ArrowDownCircle,
    emptyTitle: 'Няма открити вземания', emptyDesc: 'Всички издадени фактури са платени или все още няма издадени фактури.',
    agingTitle: 'Падежен анализ на вземанията',
    openTitle: 'Открити вземания', openDesc: 'Неплатени и частично платени фактури.',
  },
  ap: {
    kind: 'ap', title: 'Задължения', description: 'Неплатени документи към доставчици – падеж, просрочие и остатък за плащане.',
    counterpartyLabel: 'Доставчик', documentLabel: 'Документ', icon: ArrowUpCircle,
    emptyTitle: 'Няма открити задължения', emptyDesc: 'Всички осчетоводени покупки са платени или все още няма осчетоводени покупки.',
    agingTitle: 'Падежен анализ на задълженията',
    openTitle: 'Открити задължения', openDesc: 'Неплатени и частично платени документи.',
  },
};

type DueFilter = 'all' | 'overdue' | 'current';
const PAGE_SIZE = 25;

export function ArApScreen({ kind }: { kind: 'ar' | 'ap' }) {
  const cfg = CONFIG[kind];
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [payItem, setPayItem] = React.useState<OpenItem | null>(null);
  const [filter, setFilter] = React.useState<DueFilter>('all');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);

  const api = kind === 'ar'
    ? { list: Endpoints.receivables, summary: Endpoints.receivablesSummary, aging: Endpoints.receivablesAging }
    : { list: Endpoints.payables, summary: Endpoints.payablesSummary, aging: Endpoints.payablesAging };

  const listQ = useQuery({ queryKey: ['arap', kind, 'list', companyId], queryFn: () => api.list(), enabled: !!companyId });
  const sumQ = useQuery({ queryKey: ['arap', kind, 'summary', companyId], queryFn: () => api.summary(), enabled: !!companyId });
  const agingQ = useQuery({ queryKey: ['arap', kind, 'aging', companyId], queryFn: () => api.aging(), enabled: !!companyId });

  const items = React.useMemo<OpenItem[]>(() => listQ.data ?? [], [listQ.data]);
  const s = sumQ.data;
  const overdueShare = s && toNumber(s.total) > 0 ? Math.round((toNumber(s.overdue) / toNumber(s.total)) * 100) : 0;

  // Client-side filtering only (the list endpoint is unchanged).
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) =>
      (filter === 'all' || (filter === 'overdue' ? it.overdueDays > 0 : it.overdueDays <= 0))
      && (!q || (it.documentRef ?? '').toLowerCase().includes(q) || (it.counterpartyName ?? '').toLowerCase().includes(q)),
    );
  }, [items, filter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const resetPage = () => setPage(1);
  const overdueCount = items.filter((i) => i.overdueDays > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader title={cfg.title} description={cfg.description} />

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Общо открито" value={eur(s?.total ?? 0)} sub={s ? `${s.count} документа` : undefined} icon={cfg.icon} tone="primary" loading={sumQ.isLoading} />
        <StatCard label="Текущо" value={eur(s?.current ?? 0)} sub={s ? `${s.count - s.overdueCount} документа в срок` : undefined} icon={Clock} tone="neutral" loading={sumQ.isLoading} />
        <StatCard label="Просрочено" value={eur(s?.overdue ?? 0)} sub={s ? `${s.overdueCount} документа` : undefined} icon={AlertTriangle} tone="warning" valueTone={s && toNumber(s.overdue) > 0 ? 'warning' : 'foreground'} loading={sumQ.isLoading} />
        <StatCard label="Дял просрочено" value={s ? `${overdueShare}%` : '—'} sub={s ? 'от общо откритото' : undefined} icon={FileText} tone="neutral" valueTone={overdueShare > 0 ? 'warning' : 'foreground'} loading={sumQ.isLoading} />
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
        <CardHeader className="pb-3">
          <CardTitle>{cfg.openTitle}</CardTitle>
          <CardDescription>{cfg.openDesc}</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 border-b border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            value={filter}
            onChange={(v) => { setFilter(v); resetPage(); }}
            options={[
              { value: 'all', label: 'Всички', count: items.length },
              { value: 'overdue', label: 'Просрочени', count: overdueCount },
              { value: 'current', label: 'В срок', count: items.length - overdueCount },
            ]}
          />
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" placeholder={`Търси по номер или ${cfg.counterpartyLabel.toLowerCase()}`} value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
          </div>
        </div>

        {listQ.isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : listQ.isError ? (
          <div className="p-6"><ErrorState onRetry={() => listQ.refetch()} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={cfg.icon} title={cfg.emptyTitle} description={cfg.emptyDesc} />
        ) : filtered.length === 0 ? (
          <EmptyState compact icon={Search} title="Няма съвпадения" description="Променете търсенето или филтъра." action={<Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilter('all'); resetPage(); }}>Изчисти филтрите</Button>} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{cfg.documentLabel}</TableHead>
                  <TableHead>{cfg.counterpartyLabel}</TableHead>
                  <TableHead>Падеж</TableHead>
                  <TableHead className="num">Просрочие</TableHead>
                  <TableHead className="num">Общо</TableHead>
                  <TableHead className="num">Остатък</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((it) => (
                  <TableRow key={`${it.documentType}:${it.documentId}`} className="cursor-pointer" onClick={() => setPayItem(it)}>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">{it.documentRef ?? '—'}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">{it.counterpartyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{it.dueDate ? dateBG(it.dueDate) : '—'}</TableCell>
                    <TableCell className="num">
                      {it.overdueDays > 0 ? <span className="text-destructive">{it.overdueDays} дни</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="num text-muted-foreground"><Money value={it.total} /></TableCell>
                    <TableCell className="num"><Money value={it.outstanding} strong /></TableCell>
                    <TableCell><OpenItemStatus item={it} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setPayItem(it); }}>
                        <Wallet /> Плащане
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > PAGE_SIZE && (
              <Pagination page={safePage} totalPages={totalPages} total={filtered.length} unit="документа" onChange={setPage} />
            )}
          </>
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
        <Badge variant="destructive" dot>Просрочено</Badge>
        {partial && <Badge variant="warning">частично</Badge>}
      </span>
    );
  }
  return partial ? <Badge variant="warning" dot>Частично платено</Badge> : <Badge variant="neutral" dot>Текущо</Badge>;
}
