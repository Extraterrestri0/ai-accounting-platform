'use client';

import { useT } from '@/lib/i18n';
import { FEATURES } from '@/lib/marketing/content';
import { Reveal } from './reveal';

/** The 8 capability cards. `limit` renders a subset (homepage overview). */
export function FeatureGrid({ limit }: { limit?: number }) {
  const t = useT();
  const items = limit ? FEATURES.slice(0, limit) : FEATURES;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ id, icon: Icon }, i) => (
        <Reveal key={id} delay={(i % 4) * 70}>
          <div className="group h-full rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-pop">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary-soft to-secondary text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:from-primary group-hover:to-primary group-hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">{t(`marketing.features.${id}.title`)}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(`marketing.features.${id}.desc`)}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
