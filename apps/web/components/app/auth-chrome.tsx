'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { Brand } from '@/components/app/brand';
import { cn } from '@/lib/utils';

/** BG/EN language toggle wired to the app language context. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn('inline-flex h-8 items-center rounded-md border border-border bg-card p-0.5', className)} role="group" aria-label="Language">
      {(['bg', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn('h-7 rounded-[5px] px-2 text-2xs font-semibold uppercase transition-colors', lang === l ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/**
 * Centred auth layout shared by login / register: brand on top, one card, a
 * single quiet trust line. Uses the same tokens as the app (light + dark).
 */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Acco"><Brand /></Link>
        <LangToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 text-center">
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-xl border border-border bg-card p-6 sm:p-7">{children}</div>
          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-8 flex items-center justify-center gap-1.5 text-2xs text-faint">
            <ShieldCheck className="h-3.5 w-3.5" /> Данните се съхраняват и обработват в ЕС · EUR
          </p>
        </div>
      </main>
    </div>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">{label}</span><span className="h-px flex-1 bg-border" />
    </div>
  );
}
