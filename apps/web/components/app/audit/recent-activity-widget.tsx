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
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>Скорошна активност</CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/audit">Целият одит <ArrowRight /></Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {q.isLoading ? (
          <TableSkeleton rows={5} cols={2} />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState compact icon={History} title="Няма активност" description="Действията във фирмата ще се появят тук." />
        ) : (
          <div className="divide-y divide-border">
            {q.data.map((e) => <AuditEventCard key={e.id} event={e} compact className="py-2.5" />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
