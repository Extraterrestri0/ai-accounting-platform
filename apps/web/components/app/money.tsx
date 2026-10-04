import { eur, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** EUR amount, tabular. `signed` colours negatives red / positives green. */
export function Money({ value, strong, signed, className }: {
  value: number | string | null | undefined; strong?: boolean; signed?: boolean; className?: string;
}) {
  const n = toNumber(value);
  return (
    <span className={cn('tabular-nums', strong && 'font-semibold', signed && n < 0 && 'text-destructive', signed && n > 0 && 'text-success', className)} data-money>
      {eur(n)}
    </span>
  );
}

/** Back-compat alias (previous dual EUR/BGN display; EUR-only now). */
export function DualMoney({ value, strong, className }: {
  value: number | string | null | undefined; dual?: boolean; layout?: 'inline' | 'stacked'; strong?: boolean; className?: string;
}) {
  return <Money value={value} strong={strong} className={className} />;
}
