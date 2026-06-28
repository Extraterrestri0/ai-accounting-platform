import { suggestMatches, nameSimilarity, type MatchableItem, type MatchInput } from '../../src/modules/banking/domain/matching';

const ar = (id: string, ref: string, name: string, outstanding: string, dueDate?: string): MatchableItem =>
  ({ documentType: 'sales_invoice', documentId: id, documentRef: ref, counterpartyName: name, outstanding, currency: 'EUR', dueDate });
const ap = (id: string, ref: string, name: string, outstanding: string): MatchableItem =>
  ({ documentType: 'purchase_invoice', documentId: id, documentRef: ref, counterpartyName: name, outstanding, currency: 'EUR' });

const inbound = (over: Partial<MatchInput> = {}): MatchInput => ({ amount: '1200.00', transactionType: 'inbound', currency: 'EUR', bookingDate: '2026-05-14', ...over });
const outbound = (over: Partial<MatchInput> = {}): MatchInput => ({ amount: '-300.00', transactionType: 'outbound', currency: 'EUR', bookingDate: '2026-05-14', ...over });

describe('name similarity (Task 3.2)', () => {
  it('scores identical (sans legal suffix) high and unrelated low', () => {
    expect(nameSimilarity('ACME OOD', 'ACME')).toBeGreaterThan(0.9);
    expect(nameSimilarity('ACME OOD', 'Globex AD')).toBeLessThan(0.4);
  });
});

describe('inbound matching → receivables (Task 3.2)', () => {
  const items = [ar('r1', '2026-0001', 'ACME OOD', '1200.00', '2026-05-10'), ap('p1', '#9', 'Beta', '1200.00')];

  it('rule 1: invoice number found in reference (highest confidence)', () => {
    const m = suggestMatches(inbound({ reference: 'Payment for 2026-0001 thanks' }), items);
    expect(m[0]).toMatchObject({ documentId: 'r1', rule: 'doc_number_in_reference' });
    expect(m[0].confidence).toBeGreaterThanOrEqual(0.95);
  });
  it('rule 3: exact amount + counterparty', () => {
    const m = suggestMatches(inbound({ counterpartyName: 'ACME' }), items);
    expect(m[0]).toMatchObject({ documentId: 'r1', rule: 'amount_and_counterparty' });
  });
  it('rule 4: exact amount + date proximity', () => {
    const m = suggestMatches(inbound({ counterpartyName: 'Unknown' }), items);
    expect(m[0]).toMatchObject({ documentId: 'r1', rule: 'amount_and_date' });
  });
  it('never crosses direction: inbound ignores payables', () => {
    const m = suggestMatches(inbound({ counterpartyName: 'Beta' }), items);
    expect(m.every((s) => s.documentType === 'sales_invoice')).toBe(true);
  });
  it('caps suggested amount at the outstanding balance', () => {
    const m = suggestMatches(inbound({ amount: '5000.00', reference: '2026-0001' }), items);
    expect(m[0].suggestedAmount).toBe('1200.00');
  });
});

describe('outbound matching → payables (Task 3.2)', () => {
  const items = [ap('p1', '#42', 'Vendor GmbH', '300.00'), ar('r1', 'X', 'Vendor', '300.00')];
  it('matches a payable on exact amount + counterparty', () => {
    const m = suggestMatches(outbound({ counterpartyName: 'Vendor GmbH' }), items);
    expect(m[0]).toMatchObject({ documentType: 'purchase_invoice', documentId: 'p1' });
  });
  it('fuzzy counterparty + close amount (rule 5)', () => {
    const m = suggestMatches(outbound({ amount: '-301.00', counterpartyName: 'Vendor GmbH' }), [ap('p1', '#42', 'Vendor GmbH', '300.00')]);
    expect(m[0]?.rule).toBe('fuzzy_counterparty');
  });
});
