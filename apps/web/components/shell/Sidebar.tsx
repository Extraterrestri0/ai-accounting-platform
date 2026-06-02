'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp, type Role } from './AppContext';
import { t } from '@/lib/i18n';

interface NavItem { href: string; label: string; en: string; roles?: Role[]; }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Общи', items: [
    { href: '/', label: t.nav.dashboard, en: 'Dashboard' },
    { href: '/accountant', label: t.nav.accountant, en: 'Accountant', roles: ['accountant', 'owner'] },
    { href: '/company', label: t.nav.company, en: 'Company', roles: ['owner', 'approver'] },
  ] },
  { group: 'Документи', items: [
    { href: '/documents', label: t.nav.documents, en: 'Documents' },
    { href: '/extraction', label: t.nav.extraction, en: 'Extraction' },
    { href: '/suggestions', label: t.nav.suggestions, en: 'Suggestions' },
    { href: '/review', label: t.nav.review, en: 'Review' },
    { href: '/posting', label: t.nav.posting, en: 'Posting', roles: ['accountant', 'owner'] },
  ] },
  { group: 'Счетоводство', items: [
    { href: '/invoices', label: t.nav.invoices, en: 'Invoices' },
    { href: '/vat', label: t.nav.vat, en: 'VAT' },
    { href: '/reports', label: t.nav.reports, en: 'Reports' },
  ] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useApp();
  return (
    <aside className="w-60 shrink-0 border-r border-line bg-white h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 py-4 border-b border-line">
        <div className="text-lg font-semibold text-brand">{t.app}</div>
        <div className="text-xs text-muted">{t.appEn} · MVP preview</div>
      </div>
      <nav className="p-3 space-y-5">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="px-2 mb-1 text-[11px] uppercase tracking-wide text-muted">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.filter((i) => !i.roles || i.roles.includes(role)).map((i) => {
                const active = pathname === i.href;
                return (
                  <li key={i.href}>
                    <Link href={i.href} className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${active ? 'bg-brand-soft text-brand font-medium' : 'text-ink hover:bg-slate-50'}`}>
                      <span>{i.label}</span><span className="text-[11px] text-muted">{i.en}</span>
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
