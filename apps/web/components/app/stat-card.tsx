import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

/**
 * KPI card (design-system): uppercase overline label, large tabular value,
 * optional dual-currency reference + delta sub-line, tone-colored value.
 */
export function StatCard({
  label, value, sub, icon: Icon, tone = 'neutral', valueTone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'success' | 'warning' | 'neutral';
  /** Color of the big number; defaults to neutral foreground. */
  valueTone?: 'primary' | 'success' | 'warning' | 'foreground';
}) {
  const iconTones = {
    primary: 'bg-gradient-to-br from-primary-soft to-card text-primary ring-1 ring-primary/15',
    success: 'bg-gradient-to-br from-success-soft to-card text-success ring-1 ring-success/15',
    warning: 'bg-gradient-to-br from-warning-soft to-card text-warning ring-1 ring-warning/15',
    neutral: 'bg-gradient-to-br from-secondary to-card text-muted-foreground ring-1 ring-border',
  } as const;
  const valueColors = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    foreground: 'text-foreground',
  } as const;
  return (
    <Card className="group p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="t-overline">{label}</p>
          <p className={cn('text-[30px] font-extrabold leading-9 tabular-nums tracking-tight', valueColors[valueTone ?? 'foreground'])}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105', iconTones[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </Card>
  );
}
