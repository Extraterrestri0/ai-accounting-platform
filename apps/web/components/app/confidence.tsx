import { cn } from '@/lib/utils';

/**
 * Confidence (DS §11) — advisory, not decorative. Always icon/dot + text + color.
 * high ≥90% (green) · medium 70–89% (amber) · low <70% (red).
 * A deterministic check (checksum/VIES/arithmetic) is a FACT → "Validated ✓", never a %.
 */
export function ConfidenceBadge({ value, validated, source }: { value?: number; validated?: boolean; source?: string }) {
  if (source === 'human') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <span className="h-2 w-2 rounded-full bg-success" /> Ръчно
      </span>
    );
  }
  if (validated) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-success">✓ Validated</span>;
  }
  if (value === undefined || value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const tone = pct >= 90 ? 'text-success' : pct >= 70 ? 'text-warning' : 'text-destructive';
  const dot = pct >= 90 ? 'bg-success' : pct >= 70 ? 'bg-warning' : 'bg-destructive';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium tabular-nums', tone)} aria-label={`Увереност ${pct}%`}>
      <span className={cn('h-2 w-2 rounded-full', dot)} /> {pct}%
    </span>
  );
}

/** Thin meter for detail headers. */
export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const bar = pct >= 90 ? 'bg-success' : pct >= 70 ? 'bg-warning' : 'bg-destructive';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <span className={cn('block h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[12px] tabular-nums text-muted-foreground">{pct}%</span>
    </span>
  );
}
