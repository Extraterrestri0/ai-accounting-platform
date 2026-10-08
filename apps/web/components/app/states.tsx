'use client';
import { type ReactNode } from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n';

export function EmptyState({ icon: Icon = Inbox, title, description, action }: {
  icon?: typeof Inbox; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive-soft px-6 py-12 text-center">
      <AlertCircle className="mb-3 h-8 w-8 text-destructive" />
      <h3 className="text-base font-medium text-foreground">{t('states.errorTitle')}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message ?? t('states.errorDesc')}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="h-4 w-4" /> {t('states.tryAgain')}</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-2">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={c === 0 ? 'h-4 w-1/3' : 'h-4 flex-1'} />
          ))}
        </div>
      ))}
    </div>
  );
}
