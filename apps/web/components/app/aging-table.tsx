'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Money } from '@/components/app/money';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/app/states';
import { dateBG, toNumber } from '@/lib/format';
import type { AgingReport } from '@/lib/api/types';
import { CalendarClock } from 'lucide-react';

/** Tone per aging bucket: escalates current → 90+ using the semantic colours. */
const BUCKET_TEXT: Record<string, string> = {
  current: 'text-foreground',
  d1_30: 'text-foreground',
  d31_60: 'text-warning',
  d61_90: 'text-warning',
  d90_plus: 'text-destructive',
};
const BUCKET_BAR: Record<string, string> = {
  current: 'bg-brand/80',
  d1_30: 'bg-brand/50',
  d31_60: 'bg-warning/70',
  d61_90: 'bg-warning',
  d90_plus: 'bg-destructive/80',
};

/**
 * AR/AP aging report: the five Bulgarian-standard buckets (Current, 1–30, 31–60,
 * 61–90, 90+) as a compact table with a share bar per bucket. Read-only.
 */
export function AgingTable({
  title, description, report, isLoading, isError, onRetry,
}: {
  title: string;
  description?: string;
  report?: AgingReport;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const total = toNumber(report?.total);
  const buckets = report?.buckets ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-1">{description ?? (report?.asOf ? `Към ${dateBG(report.asOf)}` : 'Остатък по интервали на просрочие')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : isError ? (
          <div className="px-5 pb-5"><ErrorState onRetry={onRetry} /></div>
        ) : buckets.length === 0 ? (
          <EmptyState compact icon={CalendarClock} title="Няма данни за падежен анализ" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Интервал</TableHead>
                <TableHead className="num">Документи</TableHead>
                <TableHead className="num">Сума</TableHead>
                <TableHead className="w-[38%] min-w-[10rem]">Дял</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((b) => {
                const amt = toNumber(b.amount);
                const share = total > 0 ? Math.max(0, Math.min(100, (amt / total) * 100)) : 0;
                return (
                  <TableRow key={b.key}>
                    <TableCell className="font-medium text-foreground">{b.label}</TableCell>
                    <TableCell className="num text-muted-foreground">{b.count}</TableCell>
                    <TableCell className={cn('num', BUCKET_TEXT[b.key] ?? 'text-foreground')}><Money value={b.amount} strong={amt > 0} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${share.toFixed(0)}%`}>
                          <div className={cn('h-full rounded-full transition-[width]', BUCKET_BAR[b.key] ?? 'bg-brand/80')} style={{ width: `${share}%` }} />
                        </div>
                        <span className="t-caption w-10 shrink-0 text-right tabular-nums">{share.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-surface-2/50 hover:bg-surface-2/50">
                <TableCell className="font-semibold text-foreground">Общо</TableCell>
                <TableCell className="num text-muted-foreground">{buckets.reduce((s, b) => s + b.count, 0)}</TableCell>
                <TableCell className="num"><Money value={report?.total} strong /></TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
