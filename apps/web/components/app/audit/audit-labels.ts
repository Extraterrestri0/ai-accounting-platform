import {
  FileSpreadsheet, BookOpenCheck, Wallet, ArrowDownCircle, ArrowUpCircle, FileText, ScanLine,
  Tags, Database, ReceiptText, BarChart3, Users, Building2, Bell, ShieldCheck, Bot, Cog, Lock, BadgeCheck, Landmark,
  type LucideIcon,
} from 'lucide-react';
import type { AuditEvent } from '@/lib/api/types';

export type Tone = 'primary' | 'success' | 'warning' | 'destructive' | 'neutral';
export interface ActionMeta { label: string; icon: LucideIcon; tone: Tone; }

/** Per-category icon + default tone (the action prefix before the first dot). */
const CATEGORY_META: Record<string, { icon: LucideIcon; tone: Tone; label: string }> = {
  invoicing: { icon: FileSpreadsheet, tone: 'primary', label: 'Фактуриране' },
  ledger: { icon: BookOpenCheck, tone: 'success', label: 'Осчетоводяване' },
  payment: { icon: Wallet, tone: 'success', label: 'Плащания' },
  receivable: { icon: ArrowDownCircle, tone: 'success', label: 'Вземания' },
  payable: { icon: ArrowUpCircle, tone: 'success', label: 'Задължения' },
  document: { icon: FileText, tone: 'neutral', label: 'Документи' },
  docintel: { icon: ScanLine, tone: 'primary', label: 'Извличане / Преглед' },
  expense: { icon: Tags, tone: 'primary', label: 'Класификация' },
  masterdata: { icon: Database, tone: 'neutral', label: 'Основни данни' },
  tax: { icon: ReceiptText, tone: 'warning', label: 'ДДС' },
  reporting: { icon: BarChart3, tone: 'neutral', label: 'Отчети' },
  identity: { icon: Users, tone: 'warning', label: 'Потребители' },
  tenancy: { icon: Building2, tone: 'neutral', label: 'Фирма' },
  notification: { icon: Bell, tone: 'neutral', label: 'Известия' },
  audit: { icon: ShieldCheck, tone: 'primary', label: 'Одит' },
  period: { icon: Lock, tone: 'warning', label: 'Периоди' },
  vies: { icon: BadgeCheck, tone: 'primary', label: 'VIES' },
  bank: { icon: Landmark, tone: 'primary', label: 'Банка' },
};

/** Human BG labels for the known actions (fallbacks humanize the raw action). */
const ACTION_LABELS: Record<string, string> = {
  // invoicing
  'invoicing.document_created': 'Документ създаден',
  'invoicing.document_posted': 'Документ осчетоводен',
  'invoicing.invoice_issued': 'Фактура издадена',
  'invoicing.invoice_sent': 'Фактура изпратена',
  'invoicing.proforma_converted': 'Проформа преобразувана във фактура',
  'invoicing.payment_recorded': 'Плащане по фактура',
  // ledger
  'ledger.entry_posted': 'Счетоводна статия осчетоводена',
  'ledger.posted_from_review': 'Покупка осчетоводена',
  'ledger.entry_reversed': 'Статия сторнирана',
  'ledger.reversed': 'Статия сторнирана',
  'ledger.period_locked': 'Период заключен',
  'ledger.period_opened': 'Период отворен',
  // payments / AR-AP
  'payment.recorded': 'Плащане отчетено',
  'payment.reversed': 'Плащане сторнирано',
  'receivable.closed': 'Вземане закрито',
  'payable.closed': 'Задължение закрито',
  // documents
  'document.upload_initiated': 'Документ качен',
  'document.scanned': 'Документ сканиран',
  'document.trashed': 'Документ преместен в кошчето',
  'document.restored': 'Документ възстановен',
  'document.purged': 'Документ изтрит окончателно',
  'docintel.document_received': 'Документ приет',
  'docintel.ocr_completed': 'OCR завършен',
  'docintel.extraction_completed': 'Извличане завършено',
  'docintel.suggestion_ready': 'Предложение готово',
  'docintel.review_item_created': 'Преглед създаден',
  'docintel.review_assign': 'Преглед възложен',
  'docintel.review_edit': 'Преглед редактиран',
  'docintel.review_fields_edited': 'Полета коригирани ръчно',
  'docintel.review_approve': 'Преглед одобрен',
  'docintel.review_reject': 'Преглед отхвърлен',
  'docintel.feedback_recorded': 'Обратна връзка записана',
  // classification / learning
  'expense.classified': 'Разход класифициран',
  'expense.category_changed': 'Категория променена',
  'expense.category_approved': 'Категория одобрена',
  // masterdata
  'masterdata.counterparty_created': 'Контрагент създаден',
  'masterdata.counterparty_validated': 'Контрагент валидиран',
  'masterdata.company_settings_updated': 'Настройки на фирмата обновени',
  'masterdata.account_mappings_updated': 'Сметкоплан-съответствия обновени',
  'masterdata.catalog_item_created': 'Артикул създаден',
  'masterdata.catalog_item_updated': 'Артикул обновен',
  'masterdata.expense_category_created': 'Разходна категория създадена',
  'masterdata.expense_category_updated': 'Разходна категория обновена',
  'masterdata.chart_of_accounts_initialized': 'Сметкоплан инициализиран',
  // tax
  'tax.vat_registers_built': 'ДДС регистри изградени',
  'tax.vat_return_generated': 'ДДС справка-декларация генерирана',
  'tax.vat_period_assembled': 'ДДС период сглобен',
  'tax.vat_return_validated': 'ДДС декларация валидирана',
  'tax.vat_return_exported': 'ДДС декларация експортирана',
  // accounting periods
  'period.locked': 'Период заключен',
  'period.opened': 'Период отворен',
  // banking
  'bank.account_created': 'Банкова сметка създадена',
  'bank.account_updated': 'Банкова сметка обновена',
  'bank.statement_imported': 'Извлечение импортирано',
  'bank.transaction_created': 'Банкова транзакция',
  'bank.match_suggested': 'Предложено съвпадение',
  'bank.match_confirmed': 'Съвпадение потвърдено',
  'bank.match_rejected': 'Съвпадение отхвърлено',
  'bank.manual_match_confirmed': 'Ръчно равнение',
  // VIES
  'vies.validation_requested': 'VIES проверка заявена',
  'vies.validation_completed': 'VIES проверка завършена',
  'vies.validation_failed': 'VIES проверка неуспешна',
  'vies.dataset_generated': 'VIES декларация генерирана',
  // reporting / identity
  'reporting.report_generated': 'Отчет генериран',
  'identity.role_changed': 'Роля променена',
  'identity.user_invited': 'Потребител поканен',
  'identity.user_activated': 'Потребител активиран',
};

/** Humanize an unknown action: 'foo.bar_baz' → 'Bar baz'. */
function humanize(action: string): string {
  const rest = action.includes('.') ? action.slice(action.indexOf('.') + 1) : action;
  const s = rest.replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : action;
}

export function actionMeta(action: string): ActionMeta {
  const cat = action.includes('.') ? action.slice(0, action.indexOf('.')) : action;
  const base = CATEGORY_META[cat] ?? { icon: Cog, tone: 'neutral' as Tone, label: cat };
  let tone = base.tone;
  if (/revers|reject|trash|purg|fail|lock/.test(action)) tone = 'destructive';
  return { label: ACTION_LABELS[action] ?? humanize(action), icon: base.icon, tone };
}

const ENTITY_LABELS: Record<string, string> = {
  invoice: 'Фактура', journal_entry: 'Счетоводна статия', payment: 'Плащане', document: 'Документ',
  document_extraction: 'Извличане', review_package: 'Преглед', accounting_suggestion: 'Предложение',
  counterparty: 'Контрагент', account: 'Сметка', account_mappings: 'Сметкоплан-съответствия',
  catalog_item: 'Артикул', expense_category: 'Разходна категория', company_settings: 'Настройки',
  vat_period: 'ДДС период', vat_return: 'ДДС декларация', report_run: 'Отчет',
  accounting_period: 'Счетоводен период', vies_check: 'VIES проверка', vies_dataset: 'VIES декларация',
  bank_account: 'Банкова сметка', bank_statement: 'Извлечение', bank_transaction: 'Банкова транзакция',
};
export function entityTypeLabel(t: string): string {
  return ENTITY_LABELS[t] ?? t;
}

export const ACTOR_TYPE_LABEL: Record<string, string> = { user: 'Потребител', ai: 'AI', system: 'Система' };
export const ACTOR_TYPE_ICON: Record<string, LucideIcon> = { user: Users, ai: Bot, system: Cog };

/** Display name for the "who": email for users, role word otherwise. */
export function actorLabel(e: Pick<AuditEvent, 'actorType' | 'actorEmail'>): string {
  if (e.actorType === 'user') return e.actorEmail ?? 'Потребител';
  return ACTOR_TYPE_LABEL[e.actorType] ?? e.actorType;
}

/** Category options for the filter dropdown (stable order). */
export const AUDIT_CATEGORIES: { value: string; label: string }[] = Object.entries(CATEGORY_META)
  .map(([value, m]) => ({ value, label: m.label }));

/** Entity-type options for the filter dropdown. */
export const AUDIT_ENTITY_TYPES: { value: string; label: string }[] = Object.entries(ENTITY_LABELS)
  .map(([value, label]) => ({ value, label }));
