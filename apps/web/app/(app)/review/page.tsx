'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Upload, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import type { DocumentRow, Paginated } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { ConfidenceBadge } from '@/components/app/confidence';
import { Money } from '@/components/app/money';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateBG } from '@/lib/format';

const REVIEWABLE = ['ready', 'ready_for_review', 'extracted', 'reviewing', 'scanning', 'uploaded'];

/** The list endpoint may enrich rows with extraction summary fields; they are optional. */
type QueueRow = DocumentRow & { overallConfidence?: number; totalAmount?: number | string | null };

type Filter = 'all' | 'ready' | 'processing';
const FILTER_OF_STATUS = (s: string): Exclude<Filter, 'all'> =>
  (s === 'scanning' || s === 'uploaded') ? 'processing' : 'ready';

export default function ReviewQueuePage() {
  const { activeCompany } = useAuth();
  const router = useRouter();
  const companyId = activeCompany?.id;
  const [filter, setFilter] = React.useState<Filter>('all');

  const q = useQuery({
    queryKey: ['documents', companyId, 'review'],
    queryFn: () => Endpoints.documents({ pageSize: 100 }),
    enabled: !!companyId,
    refetchInterval: 4000, // live pipeline status
  });

  const all = ((q.data as Paginated<QueueRow> | undefined)?.items ?? []).filter((d) => REVIEWABLE.includes(d.status));
  const counts = {
    all: all.length,
    ready: all.filter((d) => FILTER_OF_STATUS(d.status) === 'ready').length,
    processing: all.filter((d) => FILTER_OF_STATUS(d.status) === 'processing').length,
  };
  const items = filter === 'all' ? all : all.filter((d) => FILTER_OF_STATUS(d.status) === filter);
  const hasSupplier = all.some((d) => !!d.counterparty);
  const hasAmount = all.some((d) => d.totalAmount !== undefined && d.totalAmount !== null);

  const openDoc = (id: string) => router.push(`/review/${id}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Преглед на документи" description="Извлечени документи, очакващи човешки преглед, одобрение и осчетоводяване." />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Всички', count: counts.all },
              { value: 'ready', label: 'За преглед', count: counts.ready },
              { value: 'processing', label: 'В обработка', count: counts.processing },
            ]}
          />
          <Button variant="outline" size="sm" asChild><Link href="/upload"><Upload /> Качи документ</Link></Button>
        </div>

        {q.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : q.isError ? (
          <div className="p-5"><ErrorState onRetry={() => q.refetch()} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={filter === 'all' ? 'Няма документи за преглед' : 'Няма документи в този филтър'}
            description={filter === 'all' ? 'Качете документ. След извличане ще се появи тук за преглед.' : 'Изберете друг филтър или качете нов документ.'}
            action={<Button asChild><Link href="/upload"><Upload /> Качи документ</Link></Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Документ</TableHead>
                {hasSupplier && <TableHead>Доставчик</TableHead>}
                {hasAmount && <TableHead className="num text-right">Сума</TableHead>}
                <TableHead>Увереност</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Дата</TableHead>
                <TableHead className="w-12"><span className="sr-only">Преглед</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow
                  key={d.id}
                  className="group cursor-pointer focus-visible:bg-surface-2/70 focus-visible:outline-none"
                  tabIndex={0}
                  onClick={() => openDoc(d.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openDoc(d.id); }}
                >
                  <TableCell className="font-medium text-foreground">
                    <span className="block max-w-[20rem] truncate">{d.originalFilename ?? d.filename ?? d.id.slice(0, 8)}</span>
                  </TableCell>
                  {hasSupplier && <TableCell className="text-muted-foreground">{d.counterparty ?? '—'}</TableCell>}
                  {hasAmount && (
                    <TableCell className="num text-right">
                      {d.totalAmount !== undefined && d.totalAmount !== null ? <Money value={d.totalAmount} /> : <span className="text-faint">—</span>}
                    </TableCell>
                  )}
                  <TableCell><ConfidenceBadge value={d.overallConfidence} /></TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{dateBG(d.createdAt)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
                      <Link href={`/review/${d.id}`} aria-label="Преглед" tabIndex={-1}><ArrowRight /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
