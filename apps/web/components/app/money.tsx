import { eur, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Currency amount — EUR only (functional currency). The legacy `dual` EUR+BGN
 * reference display has been removed; the prop is accepted for backward
 * compatibility with existing call sites but no longer renders a BGN line.
 * Stored values and accounting logic are unchanged — this is display only.
 */
export function DualMoney({
  value, layout = 'inline', strong = false, className,
}: {
  value: number | string | null | undefined;
  /** @deprecated kept for call-site compatibility; BGN reference is no longer shown. */
  dual?: boolean;
  layout?: 'inline' | 'stacked';
  strong?: boolean;
  className?: string;
}) {
  const primary = eur(toNumber(value));
  if (layout === 'stacked') {
    return (
      <span className={cn('inline-flex flex-col leading-tight tabular-nums', className)}>
        <span className={strong ? 'font-semibold' : ''}>{primary}</span>
      </span>
    );
  }
  return (
    <span className={cn('tabular-nums', className)}>
      <span className={strong ? 'font-semibold' : ''}>{primary}</span>
    </span>
  );
}
