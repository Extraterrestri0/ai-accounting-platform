/** Assistant domain models (ADR-001, Phase 1 — read-only grounded explanations). */

export const PROMPT_VERSION = 'p1.0';

/** Fixed Phase-1 question catalog. `kind:'text'` exists in the request model for Phase 2. */
export const QUESTION_KEYS = [
  'vat.payable_why', 'vat.payable_sources', 'vat.prefiling_checklist',
  'invoice.posting_why', 'invoice.treatment_why', 'invoice.deductibility', 'invoice.rule_source',
  'rp.overdue', 'rp.customers_owing', 'rp.pay_first',
  'reports.profit_why', 'reports.month_diff', 'reports.biggest_expenses',
] as const;
export type QuestionKey = (typeof QUESTION_KEYS)[number];

export type AssistantSurface = 'vat' | 'invoice' | 'reports' | 'dashboard';

export interface QuestionCatalogEntry {
  key: QuestionKey; surface: AssistantSurface; labelBg: string;
  requires: 'document' | 'period' | 'none';
}

/** Generic question model (Phase-2-proof): chips send kind:'key'; free text is rejected in P1. */
export type AskQuestion = { kind: 'key'; key: QuestionKey } | { kind: 'text'; text: string };
export interface AskContext { documentId?: string; year?: number; month?: number; }
export interface AskRequest { question: AskQuestion; context?: AskContext; }

export type CitationType =
  | 'journal_entry' | 'document' | 'vat_register_row' | 'report_cell'
  | 'rule_card' | 'payable' | 'receivable' | 'period';

export interface Citation {
  type: CitationType;
  id: string;
  label: string;          // BG display text
  href?: string;          // deep link into an existing screen
  fact?: string;          // the specific value this citation grounds (verifier key)
  ruleCard?: { version: string; legalReference: string; reviewPending: boolean };
}

/** Versioned, effective-dated, accountant-reviewable knowledge card (never model memory). */
export interface RuleCard {
  id: string; version: string;
  title: string; summary: string;
  legalReference: string; legalQuote?: string;
  effectiveFrom: string; effectiveTo: string | null;
  reviewedBy: string | null; reviewedAt: string | null;
  matchers: { expenseCategories?: string[]; vatTreatments?: string[]; keywords?: string[] };
}

/** One tool invocation in the grounding trace (results are the only source of facts). */
export interface ToolTraceEntry { tool: string; args: Record<string, unknown>; resultDigest: string; ms: number; }

/** A deterministic draft produced by a playbook before any optional LLM phrasing. */
export interface AnswerDraft {
  answerMd: string;
  citations: Citation[];
  confidence: number;
  ruleCardVersions: Record<string, string>;
  /** Every literal fact (number/date/id token) the answer is allowed to contain. */
  facts: string[];
  abstained?: boolean;
}

export interface AssistantAnswer {
  id: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  llmUsed: boolean;
  abstained: boolean;
  generatedAt: string;
}

export const QUESTION_CATALOG: QuestionCatalogEntry[] = [
  { key: 'vat.payable_why', surface: 'vat', labelBg: 'Защо дължа ДДС този месец?', requires: 'period' },
  { key: 'vat.payable_sources', surface: 'vat', labelBg: 'Кои фактури формират ДДС резултата?', requires: 'period' },
  { key: 'vat.prefiling_checklist', surface: 'vat', labelBg: 'Какво да проверя преди подаване?', requires: 'period' },
  { key: 'invoice.posting_why', surface: 'invoice', labelBg: 'Защо е осчетоводена така?', requires: 'document' },
  { key: 'invoice.treatment_why', surface: 'invoice', labelBg: 'Защо това ДДС третиране?', requires: 'document' },
  { key: 'invoice.deductibility', surface: 'invoice', labelBg: 'Може ли да се приспадне ДДС?', requires: 'document' },
  { key: 'invoice.rule_source', surface: 'invoice', labelBg: 'Кое правило породи предложението?', requires: 'document' },
  { key: 'rp.overdue', surface: 'dashboard', labelBg: 'Кои фактури са просрочени?', requires: 'none' },
  { key: 'rp.customers_owing', surface: 'dashboard', labelBg: 'Кои клиенти ми дължат пари?', requires: 'none' },
  { key: 'rp.pay_first', surface: 'dashboard', labelBg: 'Кои доставчици да платя първо?', requires: 'none' },
  { key: 'reports.profit_why', surface: 'reports', labelBg: 'Защо печалбата е по-ниска този месец?', requires: 'period' },
  { key: 'reports.month_diff', surface: 'reports', labelBg: 'Какво се промени спрямо миналия месец?', requires: 'period' },
  { key: 'reports.biggest_expenses', surface: 'reports', labelBg: 'Кои са най-големите разходи?', requires: 'period' },
];
