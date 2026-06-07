import {
  LayoutDashboard, FileText, Upload, ClipboardCheck,
  BookOpenCheck, ReceiptText, FileSpreadsheet, BarChart3, Settings, PackageSearch,
  ArrowDownCircle, ArrowUpCircle, History, Landmark,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** i18n key (lib/i18n) for the label. */
  key: string;
  href: string;
  icon: LucideIcon;
}
export interface NavGroup {
  /** i18n key for the group title. */
  titleKey: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    titleKey: 'nav.overview',
    items: [{ key: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    titleKey: 'nav.documents',
    items: [
      { key: 'nav.docs', href: '/documents', icon: FileText },
      { key: 'nav.upload', href: '/upload', icon: Upload },
      { key: 'nav.review', href: '/review', icon: ClipboardCheck },
    ],
  },
  {
    titleKey: 'nav.accounting',
    items: [
      { key: 'nav.posting', href: '/posting', icon: BookOpenCheck },
      { key: 'nav.vat', href: '/vat', icon: ReceiptText },
      { key: 'nav.invoices', href: '/invoices', icon: FileSpreadsheet },
      { key: 'nav.catalog', href: '/catalog', icon: PackageSearch },
      { key: 'nav.receivables', href: '/receivables', icon: ArrowDownCircle },
      { key: 'nav.payables', href: '/payables', icon: ArrowUpCircle },
      { key: 'nav.banking', href: '/banking', icon: Landmark },
      { key: 'nav.reports', href: '/reports', icon: BarChart3 },
    ],
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
  '/audit': 'nav.audit',
  '/settings': 'nav.settings',
  '/profile': 'profile.title',
};
