'use client';

import { History } from 'lucide-react';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { AuditEventCard } from './audit-event-card';
import { dateBG } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AuditEvent } from '@/lib/api/types';

/** Group events into day buckets, preserving the incoming order within each day. */
function groupByDay(events: AuditEvent[]): { day: string; label: string; events: AuditEvent[] }[] {
  const groups: { day: string; label: string; events: AuditEvent[] }[] = [];
  const index = new Map<string, number>();
  for (const e of events) {
    const day = (e.occurredAt ?? '').slice(0, 10);
    let i = index.get(day);
    if (i === undefined) { i = groups.length; index.set(day, i); groups.push({ day, label: dateBG(e.occurredAt), events: [] }); }
    groups[i].events.push(e);
  }
  return groups;
}

/**
 * Day-grouped list of audit events (most-recent first) rendered as stacked rows.
 * Handles loading / error / empty states. `compact` hides per-event change detail
 * (for dashboards/dialogs). `flush` lays rows edge-to-edge inside a card (px-5 gutters).
 */
export function AuditTimeline({
  events, isLoading, isError, onRetry, compact = false, flush = false, emptyTitle = 'Няма събития', emptyDesc,
}: {
  events?: AuditEvent[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  compact?: boolean;
  flush?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}) {
  if (isLoading) return <TableSkeleton rows={6} cols={compact ? 2 : 3} />;
  if (isError) return <div className={cn(flush && 'p-5')}><ErrorState onRetry={onRetry} /></div>;
  if (!events || events.length === 0) return <EmptyState icon={History} title={emptyTitle} description={emptyDesc} compact={!flush} />;

  const groups = groupByDay(events);
  const gutter = flush ? 'px-5' : 'px-0';
  return (
    <div className={cn(!flush && 'space-y-5')}>
      {groups.map((g) => (
        <section key={g.day} aria-label={g.label}>
          <h3 className={cn('t-overline flex items-center gap-2 py-1.5', gutter, flush ? 'border-b border-border bg-surface-2/60' : 'mb-1')}>
            {g.label}
            <span className="text-faint tabular-nums">{g.events.length}</span>
          </h3>
          <div className="divide-y divide-border">
            {g.events.map((e) => (
              <AuditEventCard key={e.id} event={e} compact={compact} className={cn('py-3', gutter)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
