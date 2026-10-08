import type { PostingLineInput } from './models';

const cents = (s: string): bigint => {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s.trim());
  if (!m) throw new PostingValidationError(`Invalid amount "${s}".`);
  const sign = m[1] === '-' ? -1n : 1n;
  return sign * (BigInt(m[2]) * 100n + BigInt((m[3] ?? '').padEnd(2, '0')));
};
export class PostingValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = 'PostingValidationError'; }
}

/** Deterministic pre-ledger validation: >=2 lines, positive amounts, balanced (Σdebit=Σcredit). */
export function validatePosting(lines: PostingLineInput[]): void {
  if (!lines || lines.length < 2) throw new PostingValidationError('A posting needs at least two lines.');
  let debit = 0n; let credit = 0n;
  for (const l of lines) {
    const c = cents(l.amount);
    if (c <= 0n) throw new PostingValidationError(`Line amounts must be positive (got ${l.amount}).`);
    if (!l.accountId) throw new PostingValidationError('Every line must reference a valid account.');
    if (l.direction === 'debit') debit += c; else credit += c;
  }
  if (debit !== credit) throw new PostingValidationError(`Entry is not balanced: debit ${debit} ≠ credit ${credit} (cents).`);
}
