import {
  LayoutDashboard, FileText, Upload, ClipboardCheck, BookOpenCheck, ReceiptText,
  FileSpreadsheet, BarChart3, Settings, PackageSearch, ArrowDownLeft, ArrowUpRight,
  History, Landmark, FileCode2, Sparkles, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** i18n key (lib/i18n) for the label. */
  key: string;
  href: string;
  icon: LucideIcon;
}
export interface NavGroup {
  /** i18n key for the group title; null = no heading. */
  titleKey: string | null;
  items: NavItem[];
}

/**
 * Application navigation, grouped the way a Bulgarian SME / accountant thinks
 * about the work. Every href maps to an existing route (no dead links).
 */
export const NAV: NavGroup[] = [
  { titleKey: null, items: [{ key: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard }] },
  {
    titleKey: 'nav.documents',
    items: [
      { key: 'nav.upload', href: '/upload', icon: Upload },
      { key: 'nav.review', href: '/review', icon: ClipboardCheck },
      { key: 'nav.docs', href: '/documents', icon: FileText },
    ],
  },
  {
    titleKey: 'nav.sales',
    items: [
      { key: 'nav.invoices', href: '/invoices', icon: FileSpreadsheet },
      { key: 'nav.receivables', href: '/receivables', icon: ArrowDownLeft },
      { key: 'nav.catalog', href: '/catalog', icon: PackageSearch },
    ],
  },
  {
    titleKey: 'nav.purchases',
    items: [{ key: 'nav.payables', href: '/payables', icon: ArrowUpRight }],
  },
  {
    titleKey: 'nav.bank',
    items: [{ key: 'nav.banking', href: '/banking', icon: Landmark }],
  },
  {
    titleKey: 'nav.accounting',
    items: [
      { key: 'nav.posting', href: '/posting', icon: BookOpenCheck },
      { key: 'nav.reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    titleKey: 'nav.tax',
    items: [
      { key: 'nav.vat', href: '/vat', icon: ReceiptText },
      { key: 'nav.saft', href: '/saft', icon: FileCode2 },
    ],
  },
  {
    titleKey: 'nav.ai',
    items: [{ key: 'nav.assistant', href: '/assistant', icon: Sparkles }],
  },
  {
    titleKey: 'nav.system',
    items: [
      { key: 'nav.audit', href: '/audit', icon: History },
      { key: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
];

/** i18n keys for route titles (breadcrumbs / page meta). */
export const ROUTE_TITLE_KEYS: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/documents': 'nav.docs',
  '/upload': 'upload.title',
  '/review': 'review.queueTitle',
  '/posting': 'nav.posting',
  '/vat': 'nav.vat',
  '/invoices': 'nav.invoices',
  '/catalog': 'nav.catalog',
  '/receivables': 'nav.receivables',
  '/payables': 'nav.payables',
  '/banking': 'nav.banking',
  '/reports': 'nav.reports',
  '/saft': 'nav.saft',
  '/assistant': 'nav.assistant',
  '/audit': 'nav.audit',
  '/settings': 'nav.settings',
  '/profile': 'profile.title',
};
