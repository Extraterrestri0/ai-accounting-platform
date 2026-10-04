'use client';
import { type ReactNode } from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact }: {
  icon?: typeof Inbox; title: string; description?: string; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-10' : 'px-6 py-16')}>
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive-soft/60 px-6 py-10 text-center">
      <AlertCircle className="mb-3 h-6 w-6 text-destructive" />
      <h3 className="text-[15px] font-semibold text-foreground">{t('states.errorTitle')}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{message ?? t('states.errorDesc')}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw /> {t('states.tryAgain')}</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border" aria-busy>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-11 items-center gap-6 px-5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-1/3' : 'flex-1', c === cols - 1 && 'max-w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Inline notice (info / warning / error / success) used for banners inside pages. */
export function Notice({ tone = 'info', icon: Icon, title, children, action, className }: {
  tone?: 'info' | 'warning' | 'destructive' | 'success' | 'neutral';
  icon?: typeof Inbox; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  const tones = {
    info: 'border-info/20 bg-info-soft text-info',
    warning: 'border-warning/25 bg-warning-soft text-warning',
    destructive: 'border-destructive/25 bg-destructive-soft text-destructive',
    success: 'border-success/25 bg-success-soft text-success',
    neutral: 'border-border bg-surface-2 text-muted-foreground',
  } as const;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px]', tones[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1 text-foreground">
        {title && <p className={cn('font-medium', tones[tone].split(' ').pop())}>{title}</p>}
        {children && <div className={cn('text-muted-foreground', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
