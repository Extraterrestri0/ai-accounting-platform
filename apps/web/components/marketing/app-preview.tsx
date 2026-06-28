'use client';

import { Check, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Original, illustrative mockup of the Review Queue — an honest depiction of real
 * features (AI-extracted fields, confidence tiers, suggested double-entry posting,
 * human approval). Built from design tokens; numeric/code values are sample data.
 */

type Conf = 'validated' | number;

function ConfChip({ conf, validatedLabel }: { conf: Conf; validatedLabel: string }) {
  if (conf === 'validated') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
        <Check className="h-3 w-3" />{validatedLabel}
      </span>
    );
  }
  const tone = conf >= 90 ? 'bg-primary-soft text-accent-foreground' : 'bg-warning-soft text-warning';
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', tone)}>{conf}%</span>;
}

export function AppPreview({ className }: { className?: string }) {
  const t = useT();
  const fields: { k: string; v: string; conf: Conf }[] = [
    { k: 'fSupplier', v: t('marketing.preview.vSupplier'), conf: 'validated' },
    { k: 'fEik', v: '203115431', conf: 96 },
    { k: 'fDate', v: '14.05.2026', conf: 99 },
    { k: 'fNet', v: '1 250,00 €', conf: 94 },
    { k: 'fVat', v: '250,00 €', conf: 'validated' },
    { k: 'fTotal', v: '1 500,00 €', conf: 'validated' },
  ];
  // Suggested balanced posting (debit blue · credit slate) — illustrative.
  const posting = [
    { acc: '602', amount: '1 250,00', side: 'd' as const },
    { acc: '4531', amount: '250,00', side: 'd' as const },
    { acc: '401', amount: '1 500,00', side: 'c' as const },
  ];

  return (
    <div className={cn('w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft', className)}>
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
        </span>
        <span className="ml-2 text-xs font-medium text-muted-foreground">{t('marketing.preview.title')}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          <Sparkles className="h-3 w-3" />{t('marketing.preview.tag')}
        </span>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-5">
        {/* document facsimile */}
        <div className="bg-card p-4 sm:col-span-2">
          <div className="mx-auto aspect-[3/4] w-full max-w-[220px] rounded-lg border border-border bg-background p-4">
            <div className="h-2.5 w-20 rounded bg-foreground/15" />
            <div className="mt-1.5 h-2 w-14 rounded bg-foreground/10" />
            <div className="mt-5 space-y-1.5">
              {[80, 95, 70, 88].map((w, i) => <div key={i} className="h-2 rounded bg-muted" style={{ width: `${w}%` }} />)}
            </div>
            <div className="mt-5 rounded-md bg-primary-soft p-2">
              <div className="h-2 w-16 rounded bg-primary/30" />
              <div className="mt-1.5 h-3 w-24 rounded bg-primary/50" />
            </div>
          </div>
        </div>

        {/* extracted fields + posting */}
        <div className="space-y-3 bg-card p-4 sm:col-span-3">
          <div className="divide-y divide-border rounded-lg border border-border">
            {fields.map((f) => (
              <div key={f.k} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs text-muted-foreground">{t(`marketing.preview.${f.k}`)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">{f.v}</span>
                  <ConfChip conf={f.conf} validatedLabel={t('marketing.preview.validated')} />
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="t-overline mb-2">{t('marketing.preview.suggestion')}</p>
            <div className="space-y-1.5">
              {posting.map((p) => (
                <div key={p.acc} className="flex items-center gap-2 text-sm">
                  <span className={cn('h-2 w-2 rounded-full', p.side === 'd' ? 'bg-primary' : 'bg-muted-foreground/50')} />
                  <span className="font-mono text-xs text-muted-foreground">{p.acc}</span>
                  <span className="ml-auto font-medium tabular-nums">{p.amount} €</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
          >
            <Check className="h-4 w-4" />{t('marketing.preview.approve')}
          </button>
        </div>
      </div>
    </div>
  );
}
