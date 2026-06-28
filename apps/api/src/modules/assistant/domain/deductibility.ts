import type { Citation, RuleCard } from './models';
import { cardById, resolveCards } from './rule-cards';

/**
 * Deterministic VAT-deductibility evaluator (ADR-001 §2/§6). Maps document evidence
 * (VAT treatment, expense category, amounts) to a verdict citing a rule card. It NEVER
 * guesses: missing/ambiguous evidence → 'unknown' and the playbook abstains on the verdict
 * (Invariant §2.6 — checkable tax facts are decided deterministically or not at all).
 */
export type DeductibilityVerdict = 'deductible' | 'not_deductible' | 'self_charge' | 'unknown';

export interface DeductibilityInput {
  asOfISO: string;                 // document/period date (effective-dating)
  vatTreatment?: string;           // standard | reduced | exempt | reverse_charge | intra_community
  vatAmount?: number;              // from the document
  expenseCategoryCode?: string;    // classification (e.g. VEHICLE, REPRESENTATION, OTHER)
  descriptionText?: string;        // free text matched against card keywords
}

export interface DeductibilityResult {
  verdict: DeductibilityVerdict;
  card: RuleCard | null;
  reasonBg: string;
}

const NO_DEDUCT_CARDS = ['vat.car_no_deduct', 'vat.representation_no_deduct', 'vat.personal_use_no_deduct'];

function matches(card: RuleCard, input: DeductibilityInput): boolean {
  const cat = (input.expenseCategoryCode ?? '').toUpperCase();
  const text = (input.descriptionText ?? '').toLowerCase();
  if (card.matchers.expenseCategories?.some((c) => c === cat)) return true;
  if (card.matchers.keywords?.some((k) => text.includes(k.toLowerCase()))) return true;
  return false;
}

export function evaluateDeductibility(input: DeductibilityInput): DeductibilityResult {
  const effective = resolveCards(input.asOfISO);
  const byId = (id: string) => effective.find((c) => c.id === id) ?? null;

  // 1) Explicit exclusions (чл. 70) outrank everything.
  for (const id of NO_DEDUCT_CARDS) {
    const card = byId(id);
    if (card && matches(card, input)) {
      return { verdict: 'not_deductible', card, reasonBg: `${card.title}: ${card.summary}` };
    }
  }
  // 2) Treatment-driven outcomes.
  const t = input.vatTreatment;
  if (t === 'exempt') {
    const card = byId('vat.exempt_supplies');
    return { verdict: 'not_deductible', card, reasonBg: 'Освободена доставка — не се начислява ДДС и няма данъчен кредит.' };
  }
  if (t === 'reverse_charge' || t === 'intra_community') {
    const card = byId(t === 'reverse_charge' ? 'vat.reverse_charge' : 'vat.intra_community');
    return { verdict: 'self_charge', card, reasonBg: 'Данъкът се самоначислява от получателя; при право на кредит се приспада в същия период.' };
  }
  if ((t === 'standard' || t === 'reduced') && (input.vatAmount ?? 0) > 0) {
    const card = byId('vat.right_to_deduct');
    return { verdict: 'deductible', card, reasonBg: 'Доставката е облагаема и документът носи начислен ДДС — налице е право на данъчен кредит (при ползване за облагаема дейност).' };
  }
  // 3) Anything else: refuse to assert a tax fact.
  return { verdict: 'unknown', card: null, reasonBg: 'Няма достатъчно данни (третиране/категория/ДДС сума), за да се определи правото на данъчен кредит.' };
}

/** Citation for a rule card, carrying the accountant-review flag (ADR-001 §6). */
export function ruleCardCitation(card: RuleCard): Citation {
  return {
    type: 'rule_card', id: card.id, label: `${card.title} (${card.legalReference})`,
    fact: card.legalReference,
    ruleCard: { version: card.version, legalReference: card.legalReference, reviewPending: card.reviewedBy === null },
  };
}

export { cardById };
