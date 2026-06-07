/**
 * Marketing site STRUCTURE (no user-facing strings — those live in lib/i18n/dictionaries.ts
 * under the `marketing.*` namespace and are resolved with useT()).
 *
 * This file holds only: navigation targets, icon choices, plan ids + prices, and which
 * translation keys each section renders. Keeping copy out of here preserves the
 * "no hardcoded UI strings" rule while giving components a clean, typed structure.
 */
import {
  Sparkles, ReceiptText, Scale, BookOpenCheck, Building2, FileText, ClipboardCheck, Globe,
  CheckCircle2, CalendarClock, ShieldCheck, UploadCloud, BarChart3,
  AlertTriangle, Inbox, LockKeyhole, RefreshCw, Send, FileSpreadsheet, Users, type LucideIcon,
} from 'lucide-react';

// ---- Global marketing constants ----
export const TRIAL_DAYS = 7;
/** Fixed BGN peg (CLAUDE.md §8). Prices are authored in EUR; BGN shown as reference. */
export const EUR_BGN_RATE = 1.95583;
/** TODO(payments): replace with a real demo-booking flow (Calendly/HubSpot) when available. */
export const CONTACT_EMAIL = 'hello@mgi-delta.bg';
/** Headline yearly saving, shown next to the billing toggle. Keep in sync with plan prices. */
export const YEARLY_DISCOUNT_PCT = 20;

export interface NavLink { href: string; key: string }
export const NAV_LINKS: NavLink[] = [
  { href: '/features', key: 'marketing.nav.features' },
  { href: '/pricing', key: 'marketing.nav.pricing' },
  { href: '/about', key: 'marketing.nav.about' },
  { href: '/faq', key: 'marketing.nav.faq' },
];

// ---- Features (the 8 required capabilities; all map to real platform modules) ----
export interface Feature { id: string; icon: LucideIcon }
export const FEATURES: Feature[] = [
  { id: 'aiExtraction', icon: Sparkles },
  { id: 'invoices', icon: ReceiptText },
  { id: 'vat', icon: Scale },
  { id: 'accounting', icon: BookOpenCheck },
  { id: 'tenants', icon: Building2 },
  { id: 'archive', icon: FileText },
  { id: 'review', icon: ClipboardCheck },
  { id: 'bilingual', icon: Globe },
];

// ---- Value pillars (homepage) ----
export const PILLARS: Feature[] = [
  { id: 'accuracy', icon: CheckCircle2 },
  { id: 'time', icon: CalendarClock },
  { id: 'security', icon: ShieldCheck },
  { id: 'bilingual', icon: Globe },
];

// ---- How it works (the trustworthy loop, CLAUDE.md §1) ----
export const STEPS: Feature[] = [
  { id: 'upload', icon: UploadCloud },
  { id: 'extract', icon: Sparkles },
  { id: 'review', icon: ClipboardCheck },
  { id: 'post', icon: BookOpenCheck },
  { id: 'report', icon: BarChart3 },
];

// ---- Pricing ----
export interface PlanFeature { key: string; soon?: boolean }
export interface Plan {
  id: 'starter' | 'business' | 'premium' | 'firm';
  /** EUR per month on the monthly plan. */
  priceMonthly: number;
  /** EUR per-month equivalent when billed yearly (≈ YEARLY_DISCOUNT_PCT off). */
  priceYearlyPerMonth: number;
  featured?: boolean;
  /** Accounting-firm style "talk to us" secondary CTA. */
  contactCta?: boolean;
  features: PlanFeature[];
}

/**
 * Original, provisional launch pricing (EUR). Positioned for Bulgarian SMBs/accountants.
 * TODO(payments/pricing): finalize before GA; these are placeholders pending the billing module.
 */
export const PLANS: Plan[] = [
  {
    id: 'starter',
    priceMonthly: 9,
    priceYearlyPerMonth: 7,
    features: [
      { key: 'companies1' }, { key: 'docs50' }, { key: 'aiExtraction' },
      { key: 'invoicing' }, { key: 'vatRegisters' }, { key: 'emailSupport' },
    ],
  },
  {
    id: 'business',
    priceMonthly: 19,
    priceYearlyPerMonth: 15,
    featured: true,
    features: [
      { key: 'companies3' }, { key: 'docs300' }, { key: 'aiExtraction' },
      { key: 'invoicing' }, { key: 'vatRegisters' }, { key: 'reports' },
      { key: 'review' }, { key: 'prioritySupport' },
    ],
  },
  {
    id: 'premium',
    priceMonthly: 39,
    priceYearlyPerMonth: 31,
    features: [
      { key: 'companies10' }, { key: 'docs1000' }, { key: 'everythingBusiness' },
      { key: 'archiveWorm' }, { key: 'multiUser' }, { key: 'onboarding' },
    ],
  },
  {
    id: 'firm',
    priceMonthly: 79,
    priceYearlyPerMonth: 63,
    contactCta: true,
    features: [
      { key: 'clientsUnlimited' }, { key: 'docsCustom' }, { key: 'everythingPremium' },
      { key: 'clientWorkspaces' }, { key: 'dedicatedSupport' }, { key: 'apiAccess', soon: true },
    ],
  },
];

// ---- Problem section (pain points the product removes) ----
export const PROBLEMS: Feature[] = [
  { id: 'manual', icon: CalendarClock },
  { id: 'errors', icon: AlertTriangle },
  { id: 'scattered', icon: Inbox },
];

// ---- Security & trust pillars (all real, shipped guarantees) ----
export const SECURITY: Feature[] = [
  { id: 'isolation', icon: LockKeyhole },
  { id: 'ledger', icon: Scale },
  { id: 'audit', icon: FileText },
  { id: 'residency', icon: Globe },
];

// ---- Future-ready integrations (NOT shipped — phrased honestly as roadmap) ----
export const INTEGRATIONS: Feature[] = [
  { id: 'banks', icon: RefreshCw },
  { id: 'nra', icon: Send },
  { id: 'payments', icon: ReceiptText },
  { id: 'reporting', icon: FileSpreadsheet },
];

// ---- "Built for Bulgaria" trust chips (text-only) ----
export const TRUST_BADGES: string[] = ['eik', 'vat', 'currency', 'eu', 'ai'];

// ---- Accountant multi-client value points (text-only, rendered with a check) ----
export const ACCOUNTANT_POINTS: string[] = ['multiCompany', 'workspaces', 'isolation', 'switch'];

// Re-exported so sections can show the icons next to the accountant copy if needed.
export const ACCOUNTANT_ICONS = { Building2, Users };

// ---- FAQ (the 7 required questions) ----
export const FAQS: string[] = [
  'trial', 'cancel', 'security', 'bgCompanies', 'vatInvoices', 'google', 'accountants',
];

/** Format an EUR price and its fixed-rate BGN reference, e.g. "€19" + "37,16 лв.". */
export function bgnReference(eur: number): string {
  const bgn = eur * EUR_BGN_RATE;
  return `${bgn.toFixed(2).replace('.', ',')} лв.`;
}
