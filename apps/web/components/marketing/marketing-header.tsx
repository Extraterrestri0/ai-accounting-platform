'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { getToken } from '@/lib/api/client';
import { Brand } from '@/components/app/brand';
import { Button } from '@/components/ui/button';
import { LangToggle } from './lang-toggle';
import { NAV_LINKS } from '@/lib/marketing/content';
import { cn } from '@/lib/utils';

/** Public site header. Auth-aware: shows "Open app" when a token is present, else Login + Start trial. */
export function MarketingHeader() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  // Detect auth client-side only (avoids SSR/hydration mismatch with localStorage token).
  const [authed, setAuthed] = React.useState(false);
  React.useEffect(() => { setAuthed(!!getToken()); }, []);
  React.useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" aria-label="MGI-Delta" className="shrink-0">
          <Brand tagline={null} />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground',
                pathname === l.href ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <LangToggle />
          {authed ? (
            <Button asChild size="sm"><Link href="/dashboard">{t('marketing.nav.openApp')}</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/login">{t('marketing.nav.login')}</Link></Button>
              <Button asChild size="sm"><Link href="/register">{t('marketing.nav.startTrial')}</Link></Button>
            </>
          )}
        </div>

        {/* Mobile */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <LangToggle />
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label={t(open ? 'marketing.nav.close' : 'marketing.nav.menu')}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container flex flex-col gap-1 py-3">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                {t(l.key)}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {authed ? (
                <Button asChild className="w-full"><Link href="/dashboard">{t('marketing.nav.openApp')}</Link></Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full"><Link href="/login">{t('marketing.nav.login')}</Link></Button>
                  <Button asChild className="w-full"><Link href="/register">{t('marketing.nav.startTrial')}</Link></Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
