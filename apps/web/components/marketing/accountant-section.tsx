'use client';

import Link from 'next/link';
import { Check, Building2, ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ACCOUNTANT_POINTS } from '@/lib/marketing/content';
import { Reveal } from './reveal';

export function AccountantSection() {
  const t = useT();
  // Illustrative client list for the visual (sample names; vat tag is localized).
  const clients = [
    { name: 'ТЕХНО ПЛЮС ООД', vat: true },
    { name: 'АРКА ДИЗАЙН ЕООД', vat: true },
    { name: 'ГРИЙН ФУУДС АД', vat: false },
  ];

  return (
    <div className="container grid items-center gap-12 lg:grid-cols-2">
      <Reveal>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">{t('marketing.eyebrow.accountant')}</p>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t('marketing.accountant.heading')}</h2>
        <p className="mt-3 text-pretty text-muted-foreground">{t('marketing.accountant.sub')}</p>
        <ul className="mt-6 space-y-3">
          {ACCOUNTANT_POINTS.map((id) => (
            <li key={id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-foreground">{t(`marketing.accountant.${id}`)}</span>
            </li>
          ))}
        </ul>
        <Button asChild className="mt-8">
          <Link href="/pricing">{t('marketing.accountant.cta')}<ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </Reveal>

      <Reveal delay={120}>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="t-overline mb-3">{t('marketing.accountant.workspaces')}</p>
          <div className="space-y-2.5">
            {clients.map((c, i) => (
              <div
                key={c.name}
                className={`flex items-center gap-3 rounded-lg border p-3 ${i === 0 ? 'border-primary bg-primary-soft/50 ring-1 ring-primary' : 'border-border bg-background'}`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{c.name}</span>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {c.vat ? t('marketing.accountant.vatTag') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
