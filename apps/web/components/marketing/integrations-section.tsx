'use client';

import { useT } from '@/lib/i18n';
import { INTEGRATIONS } from '@/lib/marketing/content';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';

/** Future-ready integrations — honestly labelled "Planned" (no faked capabilities). */
export function IntegrationsSection() {
  const t = useT();
  return (
    <div className="container">
      <SectionHeading
        eyebrow={t('marketing.eyebrow.integrations')}
        title={t('marketing.integrations.heading')}
        subtitle={t('marketing.integrations.sub')}
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {INTEGRATIONS.map(({ id, icon: Icon }, i) => (
          <Reveal key={id} delay={i * 70}>
            <div className="relative h-full rounded-xl border border-dashed border-border bg-card/60 p-6">
              <span className="absolute right-3 top-3 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                {t('marketing.integrations.planned')}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{t(`marketing.integrations.${id}.title`)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`marketing.integrations.${id}.desc`)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
