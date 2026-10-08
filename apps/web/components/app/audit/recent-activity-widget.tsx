'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { History, ArrowRight } from 'lucide-react';
import { Endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuditEventCard } from './audit-event-card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';

/** Dashboard "Recent Activity" — latest audit events for the active company. */
export function RecentActivityWidget({ companyId, limit = 8 }: { companyId?: string; limit?: number }) {
  const q = useQuery({
    queryKey: ['audit', 'timeline', companyId, limit],
    queryFn: () => Endpoints.auditTimeline(limit),
    enabled: !!companyId,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" /> Скорошна активност</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/audit">Целият одит <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <TableSkeleton rows={5} cols={2} />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState icon={History} title="Няма активност" description="Действията във фирмата ще се появят тук." />
        ) : (
          <div className="space-y-4">
            {q.data.map((e) => <AuditEventCard key={e.id} event={e} compact />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
