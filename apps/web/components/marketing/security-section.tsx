'use client';

import { useT } from '@/lib/i18n';
import { SECURITY } from '@/lib/marketing/content';
import { Reveal } from './reveal';

/** Dark, premium security band for contrast and trust. */
export function SecuritySection() {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-sidebar text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_15%_-20%,hsl(var(--primary)/0.30),transparent),radial-gradient(40rem_24rem_at_100%_120%,hsl(var(--success)/0.18),transparent)]" />
      <div className="container relative py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">{t('marketing.eyebrow.security')}</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t('marketing.security.heading')}</h2>
          <p className="mt-3 text-pretty text-sidebar-foreground">{t('marketing.security.sub')}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map(({ id, icon: Icon }, i) => (
            <Reveal key={id} delay={i * 70}>
              <div className="h-full rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{t(`marketing.security.${id}.title`)}</h3>
                <p className="mt-1.5 text-sm text-sidebar-foreground">{t(`marketing.security.${id}.desc`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
