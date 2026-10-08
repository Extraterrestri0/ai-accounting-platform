'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { ROUTE_TITLE_KEYS } from '@/lib/nav';
import { useT } from '@/lib/i18n';

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useT();
  const segments = pathname.split('/').filter(Boolean);
  let acc = '';
  const crumbs = segments.map((seg) => {
    acc += '/' + seg;
    const key = ROUTE_TITLE_KEYS[acc];
    return { href: acc, label: key ? t(key) : decodeURIComponent(seg) };
  });
  return (
    <nav aria-label="Navigation" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground"><Home className="h-3.5 w-3.5" /></Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-border" />
          {i === crumbs.length - 1
            ? <span className="font-medium text-foreground">{c.label}</span>
            : <Link href={c.href} className="hover:text-foreground">{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}
