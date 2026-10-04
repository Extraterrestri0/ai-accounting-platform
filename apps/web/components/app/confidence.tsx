import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Confidence — advisory, not decorative. Dot + value + colour.
 * ≥90 % green · 70–89 % amber · <70 % red. A deterministic check is a FACT →
 * "Проверено ✓", never a percentage.
 */
export function ConfidenceBadge({ value, validated, source }: { value?: number; validated?: boolean; source?: string }) {
  if (source === 'human') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Ръчно
      </span>
    );
  }
  if (validated) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Check className="h-3.5 w-3.5" /> Проверено</span>;
  }
  if (value === undefined || value === null) return <span className="text-xs text-faint">—</span>;
  const pct = Math.round(value * 100);
  const tone = pct >= 90 ? 'text-success' : pct >= 70 ? 'text-warning' : 'text-destructive';
  const dot = pct >= 90 ? 'bg-success' : pct >= 70 ? 'bg-warning' : 'bg-destructive';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium tabular-nums', tone)} aria-label={`Увереност ${pct}%`}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} /> {pct}%
    </span>
  );
}

/** Thin meter for detail headers. */
export function ConfidenceMeter({ value, width = 'w-24' }: { value: number; width?: string }) {
  const pct = Math.round(value * 100);
  const bar = pct >= 90 ? 'bg-success' : pct >= 70 ? 'bg-warning' : 'bg-destructive';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('inline-block h-1.5 overflow-hidden rounded-full bg-surface-2', width)}>
        <span className={cn('block h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </span>
  );
}
