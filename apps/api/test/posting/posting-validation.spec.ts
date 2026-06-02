import { validatePosting, PostingValidationError } from '../../src/modules/docintel/domain/posting/validation';
import type { PostingLineInput } from '../../src/modules/docintel/domain/posting/models';

const lines = (...l: [string, 'debit' | 'credit', string][]): PostingLineInput[] => l.map(([accountId, direction, amount]) => ({ accountId, direction, amount }));

describe('posting validation (deterministic, pre-ledger)', () => {
  it('accepts a balanced entry (Dr 200 + Dr 40 / Cr 240)', () => {
    expect(() => validatePosting(lines(['exp', 'debit', '200.00'], ['vat', 'debit', '40.00'], ['pay', 'credit', '240.00']))).not.toThrow();
  });
  it('rejects an unbalanced entry', () => {
    expect(() => validatePosting(lines(['exp', 'debit', '100.00'], ['pay', 'credit', '90.00']))).toThrow(PostingValidationError);
  });
  it('rejects fewer than two lines', () => {
    expect(() => validatePosting(lines(['exp', 'debit', '10.00']))).toThrow(/at least two/);
  });
  it('rejects a missing/invalid account', () => {
    expect(() => validatePosting(lines(['', 'debit', '10.00'], ['pay', 'credit', '10.00']))).toThrow(/valid account/);
  });
  it('rejects non-positive amounts', () => {
    expect(() => validatePosting(lines(['exp', 'debit', '0.00'], ['pay', 'credit', '0.00']))).toThrow(/positive/);
  });
  it('balances using exact decimal cents (no float drift)', () => {
    expect(() => validatePosting(lines(['a', 'debit', '0.10'], ['b', 'debit', '0.20'], ['c', 'credit', '0.30']))).not.toThrow();
  });
});
