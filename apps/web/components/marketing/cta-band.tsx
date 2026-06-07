'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL } from '@/lib/marketing/content';

/** Reusable bottom call-to-action band. */
export function CtaBand() {
  const t = useT();
  const demoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Demo — MGI-Delta')}`;
  return (
    <section className="border-t border-border bg-sidebar">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_50%_-20%,hsl(var(--primary)/0.35),transparent)]" />
        <div className="container relative py-16 text-center text-white">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t('marketing.cta.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sidebar-foreground">{t('marketing.cta.sub')}</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/register">{t('marketing.cta.primary')}<ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">
              <a href={demoHref}>{t('marketing.cta.secondary')}</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
