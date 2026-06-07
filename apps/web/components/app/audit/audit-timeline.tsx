'use client';

import { History } from 'lucide-react';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/app/states';
import { AuditEventCard } from './audit-event-card';
import { dateBG } from '@/lib/format';
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
 * Vertical, day-grouped audit timeline (most-recent first). Handles loading / error /
 * empty states. `compact` hides per-event change detail (for dashboards/dialogs).
 */
export function AuditTimeline({
  events, isLoading, isError, onRetry, compact = false, emptyTitle = 'Няма събития', emptyDesc,
}: {
  events?: AuditEvent[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  compact?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}) {
  if (isLoading) return <TableSkeleton rows={6} cols={compact ? 2 : 3} />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!events || events.length === 0) return <EmptyState icon={History} title={emptyTitle} description={emptyDesc} />;

  const groups = groupByDay(events);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.day}>
          <p className="t-overline mb-3">{g.label}</p>
          <div className="space-y-4 border-l border-border pl-4">
            {g.events.map((e) => (
              <AuditEventCard key={e.id} event={e} compact={compact} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
