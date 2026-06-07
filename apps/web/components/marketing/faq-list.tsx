'use client';

import { Plus } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { FAQS, TRIAL_DAYS } from '@/lib/marketing/content';

/** Native <details> accordion — accessible, zero-dependency, with a rotating + indicator. */
export function FaqList() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQS.map((id) => (
        <details
          key={id}
          className="group rounded-xl border border-border bg-card px-5 shadow-card transition-colors open:border-primary/30 hover:border-primary/30"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
            {t(`marketing.faq.${id}.q`)}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground">
              <Plus className="h-4 w-4" />
            </span>
          </summary>
          <p className="pb-5 pr-10 text-sm text-muted-foreground">
            {t(`marketing.faq.${id}.a`, { days: TRIAL_DAYS })}
          </p>
        </details>
      ))}
    </div>
  );
}
