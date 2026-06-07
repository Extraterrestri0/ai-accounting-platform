'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { TRIAL_DAYS, CONTACT_EMAIL } from '@/lib/marketing/content';
import { AppPreview } from './app-preview';
import { TrustStrip } from './trust-strip';
import { Reveal } from './reveal';

export function Hero() {
  const t = useT();
  const demoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Demo — MGI-Delta')}`;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <div className="container relative pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />{t('marketing.hero.badge')}
          </span>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t('marketing.hero.titleLead')}{' '}
            <span className="text-gradient">{t('marketing.hero.titleEm')}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t('marketing.hero.subtitle')}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full shadow-glow sm:w-auto">
              <Link href="/register">{t('marketing.hero.ctaTrial')}<ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href={demoHref}>{t('marketing.hero.ctaDemo')}</a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
              <Link href="/login">{t('marketing.hero.ctaLogin')}</Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{t('marketing.hero.note', { days: TRIAL_DAYS })}</p>
        </div>

        {/* Product preview */}
        <Reveal className="mx-auto mt-14 max-w-4xl" delay={120}>
          <AppPreview />
        </Reveal>

        <div className="mt-10 pb-14">
          <TrustStrip />
        </div>
      </div>
    </section>
  );
}
