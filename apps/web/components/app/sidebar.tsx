'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { Brand } from '@/components/app/brand';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Light application sidebar: grouped navigation, quiet labels, brand-green active marker. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <aside className="flex h-full w-[232px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Acco">
          <Brand />
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4 pt-1" aria-label="Основна навигация">
        {NAV.map((group, gi) => (
          <div key={group.titleKey ?? gi} className={cn(gi > 0 && 'mt-5')}>
            {group.titleKey && (
              <p className="mb-1 px-2.5 text-2xs font-medium uppercase tracking-[0.08em] text-faint">{t(group.titleKey)}</p>
            )}
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors',
                        active
                          ? 'bg-accent font-medium text-foreground before:absolute before:-left-3 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand'
                          : 'text-sidebar-foreground hover:bg-accent/70 hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-brand' : 'text-faint group-hover:text-muted-foreground')} strokeWidth={1.75} />
                      <span className="truncate">{t(item.key)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
