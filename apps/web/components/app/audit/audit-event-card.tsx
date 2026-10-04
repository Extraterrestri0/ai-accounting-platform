'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { dateTimeBG } from '@/lib/format';
import { actionMeta, actorLabel, entityTypeLabel, ACTOR_TYPE_LABEL, ACTOR_TYPE_ICON, type Tone } from './audit-labels';
import type { AuditEvent } from '@/lib/api/types';

const ICON_TONE: Record<Tone, string> = {
  primary: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  destructive: 'bg-destructive-soft text-destructive',
  neutral: 'bg-surface-2 text-muted-foreground',
};
const BADGE_TONE: Record<Tone, 'brand' | 'success' | 'warning' | 'destructive' | 'neutral'> = {
  primary: 'brand', success: 'success', warning: 'warning', destructive: 'destructive', neutral: 'neutral',
};
const ACTOR_BADGE: Record<string, 'neutral' | 'info' | 'outline'> = { user: 'neutral', ai: 'info', system: 'outline' };

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
 * Renders as a compact row; `compact` hides the entity badge, record ref and detail toggle.
 */
export function AuditEventCard({ event, compact = false, defaultOpen = false, className }: {
  event: AuditEvent; compact?: boolean; defaultOpen?: boolean; className?: string;
}) {
  const meta = actionMeta(event.action);
  const Icon = meta.icon;
  const ActorIcon = ACTOR_TYPE_ICON[event.actorType];
  const diff = React.useMemo(() => computeDiff(event.before, event.after), [event.before, event.after]);
  const [open, setOpen] = React.useState(defaultOpen);
  const hasDetail = diff.length > 0 || !!event.reason;

  return (
    <div className={cn('flex gap-3', className)}>
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', ICON_TONE[meta.tone])}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[13px] font-medium text-foreground">{meta.label}</span>
          {!compact && <Badge variant={BADGE_TONE[meta.tone]}>{entityTypeLabel(event.entityType)}</Badge>}
          {!compact && (
            <span className="ml-auto hidden font-mono text-[11px] tabular-nums text-faint sm:inline" title="Пореден номер в одитната верига">
              #{String(event.seq).padStart(6, '0')}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge variant={ACTOR_BADGE[event.actorType] ?? 'neutral'} className="gap-1">
            {ActorIcon && <ActorIcon className="h-3 w-3" />}
            <span className="max-w-[14rem] truncate">{actorLabel(event)}</span>
          </Badge>
          {event.actorType !== 'user' && <span>{ACTOR_TYPE_LABEL[event.actorType]}</span>}
          <span className="tabular-nums" title={dateTimeBG(event.occurredAt)}>{relativeBG(event.occurredAt)}</span>
          {!compact && <span className="hidden tabular-nums text-faint sm:inline">· {dateTimeBG(event.occurredAt)}</span>}
        </div>

        {hasDetail && !compact && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {open ? 'Скрий промените' : 'Покажи промените'}
          </button>
        )}

        {open && !compact && (
          <div className="mt-2 space-y-2">
            {event.reason && <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">Причина: <span className="text-foreground">{event.reason}</span></p>}
            {diff.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border text-xs">
                <table className="w-full">
                  <thead className="bg-surface-2 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-2xs font-medium uppercase tracking-[0.06em]">Поле</th>
                      <th className="px-3 py-1.5 text-left text-2xs font-medium uppercase tracking-[0.06em]">Преди</th>
                      <th className="px-3 py-1.5 text-left text-2xs font-medium uppercase tracking-[0.06em]">След</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {diff.map((d) => (
                      <tr key={d.field}>
                        <td className="px-3 py-1.5 font-mono text-foreground">{d.field}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground line-through decoration-destructive/40">{short(d.before)}</td>
                        <td className="px-3 py-1.5 font-mono text-foreground">{short(d.after)}</td>
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
