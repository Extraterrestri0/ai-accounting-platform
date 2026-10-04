import { type ReactNode } from 'react';
import { Breadcrumbs } from './breadcrumbs';
import { cn } from '@/lib/utils';

/** Page title block: breadcrumb trail (nested routes), title, one-line description, actions. */
export function PageHeader({ title, description, actions, className, eyebrow }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; eyebrow?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <Breadcrumbs />
        {eyebrow && <div className="t-overline mb-1">{eyebrow}</div>}
        <h1 className="t-display text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section heading inside a page (between cards). */
export function SectionHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
