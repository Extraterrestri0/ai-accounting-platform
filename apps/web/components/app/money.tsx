import { eur, bgn, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * DualCurrencyAmount (DS §12.2) — EUR primary (tabular) + muted BGN reference.
 * `dual` is on until 8 Aug 2026, then BGN hides with one prop. Tabular figures.
 */
export function DualMoney({
  value, dual = true, layout = 'inline', strong = false, className,
}: {
  value: number | string | null | undefined;
  dual?: boolean;
  layout?: 'inline' | 'stacked';
  strong?: boolean;
  className?: string;
}) {
  const n = toNumber(value);
  const primary = eur(n);
  const secondary = `≈ ${bgn(n)}`;
  if (layout === 'stacked') {
    return (
      <span className={cn('inline-flex flex-col leading-tight tabular-nums', className)}>
        <span className={strong ? 'font-semibold' : ''}>{primary}</span>
        {dual && <span className="text-[12px] text-muted-foreground">{secondary}</span>}
      </span>
    );
  }
  return (
    <span className={cn('tabular-nums', className)}>
      <span className={strong ? 'font-semibold' : ''}>{primary}</span>
      {dual && <span className="ml-2 text-[12px] text-muted-foreground">{secondary}</span>}
    </span>
  );
}
