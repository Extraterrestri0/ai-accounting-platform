/**
 * Answer confidence (ADR-001): deterministic, explainable scores — not model logits.
 * Ledger/register/aging answers are fully grounded → high. Anything resting on a rule
 * card drops when the card is pending accountant review. Abstentions are 0.
 */
import type { Citation } from './models';

export const CONFIDENCE = {
  GROUNDED_DATA: 0.95,     // figures straight from deterministic engines, no interpretation
  EXPLANATION: 0.85,       // grounded data + composed narrative (e.g. posting explanation)
  RULE_REVIEWED: 0.85,     // verdict citing an accountant-reviewed rule card
  RULE_PENDING: 0.7,       // verdict citing a card pending review (flagged in citation)
  ABSTAINED: 0,
} as const;

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, +n.toFixed(3)));

/** Drop to RULE_PENDING when any cited rule card is unreviewed. */
export function applyReviewPenalty(base: number, citations: Citation[]): number {
  const pending = citations.some((c) => c.ruleCard?.reviewPending);
  return clamp01(pending ? Math.min(base, CONFIDENCE.RULE_PENDING) : base);
}
