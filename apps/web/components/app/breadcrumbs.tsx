'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ROUTE_TITLE_KEYS } from '@/lib/nav';
import { useT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Compact trail shown above page titles; hides itself on top-level pages. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useT();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  let acc = '';
  const crumbs = segments.map((seg) => {
    acc += '/' + seg;
    const key = ROUTE_TITLE_KEYS[acc];
    const label = key ? t(key) : UUID.test(seg) ? t('nav.reviewDetail') : decodeURIComponent(seg);
    return { href: acc, label };
  });
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[13px] text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-faint" />}
          {i === crumbs.length - 1
            ? <span className="text-foreground">{c.label}</span>
            : <Link href={c.href} className="hover:text-foreground">{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}
