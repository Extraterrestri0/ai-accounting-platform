'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, FileText, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Endpoints } from '@/lib/api/endpoints';
import type { DocumentRow, Paginated } from '@/lib/api/types';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfidenceBadge } from '@/components/app/confidence';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateBG } from '@/lib/format';

const REVIEWABLE = ['ready', 'ready_for_review', 'extracted', 'reviewing', 'scanning', 'uploaded'];

export default function ReviewQueuePage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const q = useQuery({
    queryKey: ['documents', companyId, 'review'],
    queryFn: () => Endpoints.documents({ pageSize: 100 }),
    enabled: !!companyId,
    refetchInterval: 4000, // live pipeline status
  });

  const items = ((q.data as Paginated<DocumentRow>)?.items ?? []).filter((d) => REVIEWABLE.includes(d.status));

  return (
    <div className="space-y-6">
      <PageHeader title="Преглед на документи" description="Извлечени документи, очакващи човешки преглед, одобрение и осчетоводяване." />

      <Card>
        {q.isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={4} /></div>
        ) : q.isError ? (
          <div className="p-6"><ErrorState onRetry={() => q.refetch()} /></div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ClipboardCheck}
              title="Няма документи за преглед"
              description="Качете документ — след извличане ще се появи тук за преглед."
              action={<Button asChild><Link href="/upload">Качи документ</Link></Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Документ</TableHead>
                <TableHead>Сигурност</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Качен</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-foreground">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground"><FileText className="h-4 w-4" /></span>
                      <span className="max-w-[18rem] truncate">{d.originalFilename ?? d.filename ?? d.id.slice(0, 8)}</span>
                    </span>
                  </TableCell>
                  <TableCell><ConfidenceBadge value={(d as any).overallConfidence} /></TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{dateBG(d.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/review/${d.id}`}>Преглед <ArrowRight className="h-4 w-4" /></Link>
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

