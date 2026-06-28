'use client';

import * as React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuditTimeline } from '@/components/app/audit/audit-timeline';
import { AuditFilters, type AuditFilterState } from '@/components/app/audit/audit-filters';
import { AuditIntegrityStatus } from '@/components/app/audit/audit-integrity-status';

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  const [filter, setFilter] = React.useState<AuditFilterState>({});
  const [page, setPage] = React.useState(1);

  // Reset to page 1 whenever the filter changes.
  const onFilter = (next: AuditFilterState) => { setFilter(next); setPage(1); };

  const q = useQuery({
    queryKey: ['audit', 'list', companyId, filter, page],
    queryFn: () => Endpoints.audit({ ...filter, page, pageSize: PAGE_SIZE }),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
  });

  const data = q.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <PageHeader title="Одитна следа" description="Пълна, непроменяема хронология на действията във фирмата — кой, кога и какво е променил." />

      <AuditIntegrityStatus />

      <Card>
        <CardContent className="space-y-5 p-5">
          <AuditFilters value={filter} onChange={onFilter} />

          <AuditTimeline
            events={data?.items}
            isLoading={q.isLoading}
            isError={q.isError}
            onRetry={() => q.refetch()}
            emptyTitle="Няма намерени събития"
            emptyDesc="Опитайте да промените филтрите или времевия диапазон."
          />

          {total > 0 && (
            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground tabular-nums">{from}–{to} от {total}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || q.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" /> Назад
                </Button>
                <span className="tabular-nums text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages || q.isFetching} onClick={() => setPage((p) => p + 1)}>
                  Напред <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
