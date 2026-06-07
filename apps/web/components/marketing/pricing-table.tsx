'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PLANS, TRIAL_DAYS, YEARLY_DISCOUNT_PCT, CONTACT_EMAIL, bgnReference, type Plan,
} from '@/lib/marketing/content';
import { Reveal } from './reveal';

type Cycle = 'monthly' | 'yearly';

export function PricingTable() {
  const t = useT();
  const [cycle, setCycle] = React.useState<Cycle>('yearly');

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm">
          {(['monthly', 'yearly'] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              aria-pressed={cycle === c}
              className={cn(
                'rounded-full px-5 py-1.5 text-sm font-medium transition-colors',
                cycle === c ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`marketing.pricing.${c}`)}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
          {t('marketing.pricing.yearlyHint', { pct: YEARLY_DISCOUNT_PCT })}
        </span>
      </div>

      {/* Plan cards */}
      <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.id} delay={(i % 4) * 70} className="h-full">
            <PlanCard plan={plan} cycle={cycle} />
          </Reveal>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {t('marketing.pricing.vatNote')} · {t('marketing.pricing.currencyNote')} · {t('marketing.pricing.betaNote')}
      </p>
    </div>
  );
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: Cycle }) {
  const t = useT();
  const eur = cycle === 'yearly' ? plan.priceYearlyPerMonth : plan.priceMonthly;
  const yearlyTotal = plan.priceYearlyPerMonth * 12;
  const trialHref = `/register?plan=${plan.id}&billing=${cycle}`;
  const contactHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${plan.id} — MGI-Delta`)}`;

  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl border bg-card p-6',
        plan.featured
          ? 'border-primary/40 shadow-glow lg:-translate-y-1'
          : 'border-border shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop',
      )}
    >
      {plan.featured && (
        <>
          <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary to-success" />
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
            {t('marketing.pricing.mostPopular')}
          </span>
        </>
      )}

      <h3 className="text-lg font-semibold">{t(`marketing.pricing.plans.${plan.id}.name`)}</h3>
      <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">{t(`marketing.pricing.plans.${plan.id}.tagline`)}</p>

      <div className="mt-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">€{eur}</span>
          <span className="text-sm text-muted-foreground">{t('marketing.pricing.perMonth')}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {bgnReference(eur)}
          {cycle === 'yearly' && <> · {t('marketing.pricing.billedYearly', { total: `€${yearlyTotal}` })}</>}
        </p>
      </div>

      <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" />{t('marketing.pricing.trialBadge', { days: TRIAL_DAYS })}
      </span>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f.key} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <Check className="h-3 w-3" />
            </span>
            <span className="text-foreground">
              {t(`marketing.pricing.feat.${f.key}`)}
              {f.soon && <span className="ml-1 text-xs text-muted-foreground">({t('common.soon')})</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-2">
        <Button asChild size="lg" className="w-full" variant={plan.featured ? 'default' : 'outline'}>
          <Link href={trialHref}>{t('marketing.pricing.ctaTrial')}</Link>
        </Button>
        {plan.contactCta && (
          <Button asChild variant="ghost" className="w-full">
            <a href={contactHref}>{t('marketing.pricing.ctaContact')}</a>
          </Button>
        )}
      </div>
    </div>
  );
}
