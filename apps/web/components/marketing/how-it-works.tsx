'use client';

import { useT } from '@/lib/i18n';
import { STEPS } from '@/lib/marketing/content';

export function HowItWorks() {
  const t = useT();
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {STEPS.map(({ id, icon: Icon }, i) => (
        <li key={id} className="relative rounded-lg border border-border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">{t(`marketing.how.${id}.title`)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t(`marketing.how.${id}.desc`)}</p>
        </li>
      ))}
    </ol>
  );
}
