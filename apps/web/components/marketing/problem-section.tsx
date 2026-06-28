'use client';

import { useT } from '@/lib/i18n';
import { PROBLEMS } from '@/lib/marketing/content';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';

export function ProblemSection() {
  const t = useT();
  return (
    <div className="container">
      <SectionHeading
        eyebrow={t('marketing.eyebrow.problem')}
        title={t('marketing.problem.heading')}
        subtitle={t('marketing.problem.sub')}
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {PROBLEMS.map(({ id, icon: Icon }, i) => (
          <Reveal key={id} delay={i * 80}>
            <div className="h-full rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-destructive-soft text-destructive">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{t(`marketing.problem.${id}.title`)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`marketing.problem.${id}.desc`)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
