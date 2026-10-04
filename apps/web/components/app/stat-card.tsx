import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * KPI tile: small label, large tabular value, optional sub-line / trend / link.
 * Colour is reserved for meaning (positive, needs attention); default is ink.
 */
export function StatCard({
  label, value, sub, icon: Icon, tone = 'neutral', valueTone, href, className, loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'success' | 'warning' | 'neutral';
  valueTone?: 'primary' | 'success' | 'warning' | 'destructive' | 'foreground';
  href?: string;
  className?: string;
  loading?: boolean;
}) {
  const valueColors = {
    primary: 'text-brand',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    foreground: 'text-foreground',
  } as const;
  const iconTone = {
    primary: 'text-brand', success: 'text-success', warning: 'text-warning', neutral: 'text-faint',
  } as const;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="t-overline">{label}</p>
        {Icon && <Icon className={cn('h-4 w-4', iconTone[tone])} strokeWidth={1.75} />}
      </div>
      <p className={cn('mt-3 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em]', valueColors[valueTone ?? 'foreground'], loading && 'skeleton h-7 w-28 text-transparent')}>{value}</p>
      {(sub || href) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {sub ? <p className="t-caption truncate">{sub}</p> : <span />}
          {href && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />}
        </div>
      )}
    </>
  );
  const cls = cn('group block rounded-lg border border-border bg-card p-5', href && 'transition-colors hover:border-border-strong', className);
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
