'use client';

import * as React from 'react';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Acco brand mark — forest rounded square with brass bars (matches the site). */
export function AccoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={cn('h-8 w-8 shrink-0', className)} fill="none" role="img" aria-label="Acco">
      <rect width="34" height="34" rx="9" fill="#123A33" />
      <rect x="9" y="17" width="3.4" height="8" rx="1.7" fill="#D9B978" />
      <rect x="15.3" y="13" width="3.4" height="12" rx="1.7" fill="#D9B978" />
      <rect x="21.6" y="9" width="3.4" height="16" rx="1.7" fill="#E9C98C" />
    </svg>
  );
}

/** Acco brand lockup: mark + Newsreader wordmark + tagline. */
export function AccoBrand({ tagline, tone = 'dark', className }: { tagline?: string | null; tone?: 'dark' | 'light'; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AccoMark />
      <div className="min-w-0 leading-tight">
        <div
          className={cn('text-[18px] font-medium tracking-tight', tone === 'light' ? 'text-white' : 'text-[#123A33]')}
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          Acco
        </div>
        {tagline && <div className={cn('text-[11px]', tone === 'light' ? 'text-white/60' : 'text-muted-foreground')}>{tagline}</div>}
      </div>
    </div>
  );
}

/** BG/EN language toggle wired to the app language context (replaces theme toggle on auth). */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={cn('inline-flex items-center overflow-hidden rounded-full border text-xs font-semibold', className)}
      style={{ borderColor: '#D6CCB7' }}
    >
      {(['bg', 'en'] as const).map((l) => {
        const on = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={on}
            className="cursor-pointer px-3 py-1.5 transition-colors"
            style={on ? { background: '#123A33', color: '#F4EFE4' } : { background: 'transparent', color: '#7c857f' }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
