import { canonicalFingerprint } from '../../src/platform/database/idempotency.repository';

/** The request fingerprint is deterministic and order-insensitive for object keys. */
describe('canonicalFingerprint', () => {
  const base = {
    postingDate: '2026-05-10', currency: 'EUR', sourceType: 'manual', sourceRef: null, description: 'x',
    lines: [{ accountId: 'a', direction: 'debit', amount: '10.00', narrative: null }, { accountId: 'b', direction: 'credit', amount: '10.00', narrative: null }],
  };

  it('is deterministic (same input → same sha256 hex)', () => {
    expect(canonicalFingerprint('ledger.post', base)).toBe(canonicalFingerprint('ledger.post', base));
    expect(canonicalFingerprint('ledger.post', base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores object property order at every level', () => {
    const reordered = {
      lines: base.lines.map((l) => ({ narrative: l.narrative, amount: l.amount, direction: l.direction, accountId: l.accountId })),
      description: 'x', sourceRef: null, sourceType: 'manual', currency: 'EUR', postingDate: '2026-05-10',
    };
    expect(canonicalFingerprint('ledger.post', reordered)).toBe(canonicalFingerprint('ledger.post', base));
  });

  it('changes on any semantic change (amount, account, date, direction)', () => {
    const fp = canonicalFingerprint('ledger.post', base);
    const variants = [
      { ...base, postingDate: '2026-05-11' },
      { ...base, lines: [{ ...base.lines[0], amount: '11.00' }, { ...base.lines[1], amount: '11.00' }] },
      { ...base, lines: [{ ...base.lines[0], accountId: 'z' }, base.lines[1]] },
      { ...base, lines: [{ ...base.lines[0], direction: 'credit' }, { ...base.lines[1], direction: 'debit' }] },
    ];
    for (const v of variants) expect(canonicalFingerprint('ledger.post', v)).not.toBe(fp);
  });

  it('is scoped by operation (same payload, different operation → different fingerprint)', () => {
    expect(canonicalFingerprint('ledger.post', base)).not.toBe(canonicalFingerprint('payment.record', base));
  });
});
