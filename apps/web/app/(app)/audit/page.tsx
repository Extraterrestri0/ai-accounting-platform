'use client';

import * as React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
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

  return (
    <div className="space-y-6">
      <PageHeader title="Одитна следа" description="Пълна, непроменяема хронология на действията във фирмата: кой, кога и какво е променил." />

      <AuditIntegrityStatus />

      <Card>
        <div className="border-b border-border px-5 py-3">
          <AuditFilters value={filter} onChange={onFilter} />
        </div>

        <div className={q.isFetching && !q.isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <AuditTimeline
            flush
            events={data?.items}
            isLoading={q.isLoading}
            isError={q.isError}
            onRetry={() => q.refetch()}
            emptyTitle="Няма намерени събития"
            emptyDesc="Опитайте да промените филтрите или времевия диапазон."
          />
        </div>

        {total > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} unit={total === 1 ? 'събитие' : 'събития'} onChange={setPage} />
        )}
      </Card>
    </div>
  );
}
