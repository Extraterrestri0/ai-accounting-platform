'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { Brand } from '@/components/app/brand';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center px-4">
        <Brand tone="dark" />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-3">
        {NAV.map((group) => (
          <div key={group.titleKey}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t(group.titleKey)}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                        active
                          ? 'bg-gradient-to-r from-primary-soft to-primary-soft/30 font-semibold text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-grad-primary'
                          : 'font-medium text-foreground/75 hover:bg-secondary hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px] transition-colors', active ? 'text-primary' : 'text-muted-foreground')} />
                      {t(item.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">EUR функционална валута · BGN референция</p>
      </div>
    </aside>
  );
}
