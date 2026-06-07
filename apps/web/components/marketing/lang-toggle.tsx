'use client';

import { useLang, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Compact BG/EN switch — same control as the app topbar, reused on the public site. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn('flex items-center rounded-md border border-border p-0.5', className)}>
      {(['bg', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-semibold uppercase transition-colors',
            lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
