'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { dateTimeBG } from '@/lib/format';
import { actionMeta, actorLabel, entityTypeLabel, ACTOR_TYPE_LABEL, type Tone } from './audit-labels';
import type { AuditEvent } from '@/lib/api/types';

const ICON_TONE: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary ring-primary/15',
  success: 'bg-success-soft text-success ring-success/15',
  warning: 'bg-warning-soft text-warning ring-warning/15',
  destructive: 'bg-destructive-soft text-destructive ring-destructive/15',
  neutral: 'bg-secondary text-muted-foreground ring-border',
};
const BADGE_TONE: Record<Tone, 'default' | 'success' | 'warning' | 'destructive' | 'neutral'> = {
  primary: 'default', success: 'success', warning: 'warning', destructive: 'destructive', neutral: 'neutral',
};

/** Whole-day relative label in Bulgarian; falls back to the absolute date/time. */
function relativeBG(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'току-що';
  if (min < 60) return `преди ${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.floor(h / 24);
  if (d < 30) return `преди ${d} дни`;
  return dateTimeBG(iso);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function short(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

interface DiffRow { field: string; before?: unknown; after?: unknown; }
function computeDiff(before: unknown, after: unknown): DiffRow[] {
  if (isObj(before) && isObj(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .slice(0, 12)
      .map((k) => ({ field: k, before: before[k], after: after[k] }));
  }
  if (isObj(after)) return Object.keys(after).slice(0, 12).map((k) => ({ field: k, after: after[k] }));
  if (isObj(before)) return Object.keys(before).slice(0, 12).map((k) => ({ field: k, before: before[k] }));
  return [];
}

/**
 * One audit event: who · what · when + an expandable before/after change view.
 * Pure presentation — never shows hash-chain internals or journal-entry detail.
 */
export function AuditEventCard({ event, compact = false, defaultOpen = false }: {
  event: AuditEvent; compact?: boolean; defaultOpen?: boolean;
}) {
  const meta = actionMeta(event.action);
  const Icon = meta.icon;
  const diff = React.useMemo(() => computeDiff(event.before, event.after), [event.before, event.after]);
  const [open, setOpen] = React.useState(defaultOpen);
  const hasDetail = diff.length > 0 || !!event.reason;

  return (
    <div className="flex gap-3">
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1', ICON_TONE[meta.tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-foreground">{meta.label}</span>
          {!compact && <Badge variant={BADGE_TONE[meta.tone]}>{entityTypeLabel(event.entityType)}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{actorLabel(event)}</span>
          {event.actorType !== 'user' && <span> · {ACTOR_TYPE_LABEL[event.actorType]}</span>}
          <span> · {relativeBG(event.occurredAt)}</span>
          {!compact && <span> · {dateTimeBG(event.occurredAt)}</span>}
        </p>

        {hasDetail && !compact && (
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {open ? 'Скрий промените' : 'Покажи промените'}
          </button>
        )}

        {open && !compact && (
          <div className="mt-2 space-y-2">
            {event.reason && <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">Причина: {event.reason}</p>}
            {diff.length > 0 && (
              <div className="overflow-hidden rounded-md border text-xs">
                <table className="w-full">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr><th className="px-3 py-1.5 text-left font-medium">Поле</th><th className="px-3 py-1.5 text-left font-medium">Преди</th><th className="px-3 py-1.5 text-left font-medium">След</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {diff.map((d) => (
                      <tr key={d.field}>
                        <td className="px-3 py-1.5 font-medium text-foreground">{d.field}</td>
                        <td className="px-3 py-1.5 text-muted-foreground line-through decoration-destructive/40">{short(d.before)}</td>
                        <td className="px-3 py-1.5 text-foreground">{short(d.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
