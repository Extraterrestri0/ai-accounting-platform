/**
 * AI Accountant domain (ADR-001): deductibility evaluator (never guesses), delta math,
 * verifier (no hallucinated figures), rule-card schema (review flags + effective dating),
 * confidence behavior.
 */
import { evaluateDeductibility } from '../../src/modules/assistant/domain/deductibility';
import { pnlDelta, topExpenses, vatDrivers } from '../../src/modules/assistant/domain/delta';
import { extractFacts, verifyAnswer } from '../../src/modules/assistant/domain/verifier';
import { RULE_CARDS, resolveCards } from '../../src/modules/assistant/domain/rule-cards';
import { CONFIDENCE, applyReviewPenalty } from '../../src/modules/assistant/domain/confidence';
import type { Citation } from '../../src/modules/assistant/domain/models';

describe('deductibility evaluator — deterministic, never guesses', () => {
  const asOfISO = '2026-06-01';
  it('car expenses → not deductible, citing чл. 70', () => {
    const r = evaluateDeductibility({ asOfISO, vatTreatment: 'standard', vatAmount: 200, expenseCategoryCode: 'VEHICLE' });
    expect(r.verdict).toBe('not_deductible');
    expect(r.card?.id).toBe('vat.car_no_deduct');
    expect(r.card?.legalReference).toContain('чл. 70');
  });
  it('representation expenses → not deductible', () => {
    const r = evaluateDeductibility({ asOfISO, vatTreatment: 'standard', vatAmount: 50, expenseCategoryCode: 'REPRESENTATION' });
    expect(r.verdict).toBe('not_deductible');
  });
  it('standard 20% with VAT amount → deductible (чл. 69)', () => {
    const r = evaluateDeductibility({ asOfISO, vatTreatment: 'standard', vatAmount: 200, expenseCategoryCode: 'SERVICES' });
    expect(r.verdict).toBe('deductible');
    expect(r.card?.id).toBe('vat.right_to_deduct');
  });
  it('reverse charge → self-charge verdict', () => {
    expect(evaluateDeductibility({ asOfISO, vatTreatment: 'reverse_charge' }).verdict).toBe('self_charge');
  });
  it('no treatment + no VAT amount → unknown (abstain), never a guessed verdict', () => {
    expect(evaluateDeductibility({ asOfISO }).verdict).toBe('unknown');
  });
  it('keyword matching catches "лек автомобил" in the description', () => {
    const r = evaluateDeductibility({ asOfISO, vatTreatment: 'standard', vatAmount: 80, descriptionText: 'Гориво за лек автомобил' });
    expect(r.verdict).toBe('not_deductible');
  });
});

describe('delta service — pure math over report outputs', () => {
  it('computes month-over-month P&L change and the driver', () => {
    const d = pnlDelta({ revenue: '1000.00', expense: '400.00', netProfit: '600.00' },
                       { revenue: '1000.00', expense: '100.00', netProfit: '900.00' });
    expect(d.netProfit.change).toBe(-300);
    expect(d.expense.change).toBe(300);
    expect(d.driver).toBe('expense');
  });
  it('ranks expense accounts from the trial balance', () => {
    const top = topExpenses([
      { accountCode: '602', accountName: 'Услуги', type: 'expense', debit: '500.00', credit: '0', balance: '500.00' },
      { accountCode: '601', accountName: 'Материали', type: 'expense', debit: '900.00', credit: '0', balance: '900.00' },
      { accountCode: '411', accountName: 'Клиенти', type: 'asset', debit: '100.00', credit: '0', balance: '100.00' },
    ]);
    expect(top.map((t) => t.accountCode)).toEqual(['601', '602']);
  });
  it('finds the biggest VAT drivers in the registers', () => {
    const d = vatDrivers(
      [{ journalEntryId: 'a', kind: 'sales', base: 100, vat: 20, deductible: 0 }, { journalEntryId: 'b', kind: 'sales', base: 500, vat: 100, deductible: 0 }],
      [{ journalEntryId: 'c', kind: 'purchase', base: 50, vat: 10, deductible: 10 }],
    );
    expect(d.topOutput[0].journalEntryId).toBe('b');
    expect(d.topDeductible[0].deductible).toBe(10);
  });
});

describe('verifier — no hallucinated figures (ADR-001 hard rule)', () => {
  it('passes when every fact in the text exists in the allowed set', () => {
    const draft = 'Дължиш 320.00 ДДС за 06.2026 (запис ad4a7b62-f398-4524-90b2-78d313405670).';
    const r = verifyAnswer(draft, extractFacts(draft));
    expect(r.ok).toBe(true);
  });
  it('catches an ALTERED number from an LLM', () => {
    const facts = extractFacts('Дължиш 320.00 ДДС.');
    const r = verifyAnswer('Дължиш 350.00 ДДС.', facts);
    expect(r.ok).toBe(false);
    expect(r.unknownFacts).toContain('350');
  });
  it('catches an INVENTED date', () => {
    const r = verifyAnswer('Срокът е 2026-09-30.', extractFacts('Няма данни.'));
    expect(r.ok).toBe(false);
  });
  it('tolerates small list ordinals (3 фактури) and number formatting (1 200,00 vs 1200.00)', () => {
    const facts = extractFacts('Общо 1200.00.');
    expect(verifyAnswer('Има 3 фактури за общо 1 200,00.', facts).ok).toBe(true);
  });
});

describe('rule cards — schema contract (review flags, effective dating, citations)', () => {
  it('every card carries version, legalReference, effectiveFrom and review fields', () => {
    for (const c of RULE_CARDS) {
      expect(c.version).toBeTruthy();
      expect(c.legalReference).toMatch(/чл\.|ЗДДС/);
      expect(c.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c).toHaveProperty('effectiveTo');
      expect(c).toHaveProperty('reviewedBy');
      expect(c).toHaveProperty('reviewedAt');
    }
  });
  it('resolves cards as-of a date (effective dating)', () => {
    expect(resolveCards('2026-06-01').length).toBe(RULE_CARDS.length);
    expect(resolveCards('2000-01-01').length).toBe(0); // before any effectiveFrom
  });
});

describe('confidence — pending accountant review lowers the score', () => {
  it('caps at RULE_PENDING when a cited card is unreviewed', () => {
    const citations: Citation[] = [{ type: 'rule_card', id: 'x', label: 'x', ruleCard: { version: '1.0', legalReference: 'чл. 70', reviewPending: true } }];
    expect(applyReviewPenalty(CONFIDENCE.GROUNDED_DATA, citations)).toBe(CONFIDENCE.RULE_PENDING);
  });
  it('keeps the base score when no rule card is pending', () => {
    expect(applyReviewPenalty(CONFIDENCE.GROUNDED_DATA, [])).toBe(CONFIDENCE.GROUNDED_DATA);
  });
});
