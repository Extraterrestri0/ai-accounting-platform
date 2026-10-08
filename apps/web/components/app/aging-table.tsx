'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DualMoney } from '@/components/app/money';
import { TableSkeleton, ErrorState } from '@/components/app/states';
import type { AgingReport } from '@/lib/api/types';

/** Tone per aging bucket — escalates current → 90+ using the DS semantic colors. */
const BUCKET_TONE: Record<string, string> = {
  current: 'text-foreground',
  d1_30: 'text-foreground',
  d31_60: 'text-warning',
  d61_90: 'text-warning',
  d90_plus: 'text-destructive',
};

/**
 * AR/AP aging report — the five Bulgarian-standard buckets (Current, 1–30, 31–60,
 * 61–90, 90+) as a responsive card. Read-only; no journal entries surfaced.
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
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={1} cols={5} />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(report?.buckets ?? []).map((b) => (
              <div key={b.key} className="rounded-lg border bg-card p-3">
                <p className="t-overline">{b.label}</p>
                <p className={cn('mt-1 text-lg font-bold tabular-nums', BUCKET_TONE[b.key] ?? 'text-foreground')}>
                  <DualMoney value={b.amount} dual={false} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{b.count} док.</p>
              </div>
            ))}
          </div>
        )}
        {report && !isLoading && !isError && (
          <div className="mt-3 flex justify-end border-t pt-3 text-sm">
            <span className="text-muted-foreground">Общо:&nbsp;</span>
            <DualMoney value={report.total} strong />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
