'use client';

import * as React from 'react';
import { Menu, Search } from 'lucide-react';
import { CompanySwitcher } from './company-switcher';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button';
import { useT, useLang, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const t = useT();
  const { lang, setLang } = useLang();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar} aria-label="Menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">{t('topbar.company')}</span>
        <CompanySwitcher />
      </div>

      <div className="relative ml-auto hidden max-w-xs flex-1 lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder={t('topbar.searchPh')}
          className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-3 lg:ml-3">
        <span className="hidden text-xs text-muted-foreground xl:inline">{t('topbar.rate')}</span>
        <div className="flex items-center rounded-md border border-border p-0.5">
          {(['bg', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn('rounded px-2 py-0.5 text-xs font-semibold uppercase transition-colors',
                lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
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
