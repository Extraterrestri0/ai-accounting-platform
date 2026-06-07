'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { Brand } from '@/components/app/brand';
import { NAV_LINKS } from '@/lib/marketing/content';

/** Public site footer. Static current year is fine for SEO/marketing. */
const YEAR = 2026; // TODO: bump or derive at build time; kept static for static-export friendliness.

export function MarketingFooter() {
  const t = useT();
  return (
    <footer className="border-t border-border bg-card">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Brand tagline={null} />
          <p className="max-w-xs text-sm text-muted-foreground">{t('marketing.footer.tagline')}</p>
          <p className="text-xs text-muted-foreground">{t('marketing.footer.residency')}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('marketing.footer.product')}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {NAV_LINKS.filter((l) => l.href === '/features' || l.href === '/pricing').map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-foreground">{t(l.key)}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('marketing.footer.company')}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {NAV_LINKS.filter((l) => l.href === '/about' || l.href === '/faq').map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-foreground">{t(l.key)}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('marketing.nav.login')}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">{t('marketing.footer.login')}</Link></li>
            <li><Link href="/register" className="hover:text-foreground">{t('marketing.footer.register')}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col gap-2 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{t('marketing.footer.rights', { year: YEAR })}</span>
          <span>{t('marketing.footer.beta')}</span>
        </div>
      </div>
    </footer>
  );
}
