'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { CompanySwitcher } from './company-switcher';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button';
import { useLang, useT, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Slim top bar: company context on the left, preferences + account on the right. */
export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { lang, setLang } = useLang();
  const t = useT();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={onOpenSidebar} aria-label={t('topbar.menu')}>
        <Menu className="h-5 w-5" />
      </Button>

      <CompanySwitcher />

      <div className="ml-auto flex items-center gap-2">
        <div className="flex h-8 items-center rounded-md border border-border bg-card p-0.5" role="group" aria-label="Language">
          {(['bg', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn('h-7 rounded-[5px] px-2 text-2xs font-semibold uppercase transition-colors',
                lang === l ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
