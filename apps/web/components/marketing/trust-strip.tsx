'use client';

import { useT } from '@/lib/i18n';
import { TRUST_BADGES } from '@/lib/marketing/content';

/** Compact "built for Bulgaria" chip row, shown under the hero. */
export function TrustStrip() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <span className="t-overline">{t('marketing.trust.label')}</span>
      {TRUST_BADGES.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {t(`marketing.trust.${id}`)}
        </span>
      ))}
    </div>
  );
}
