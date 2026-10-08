import { LedgerService } from '../../src/modules/ledger/application/ledger.service';
import { PeriodLockedError } from '../../src/modules/periods/domain/errors';

/**
 * Proves the ledger compliance gate (Task 4.3): every posting and reversal is
 * blocked when the accounting-period service reports the target period as locked.
 * Because invoice issuance, payment postings and purchase approvals all post
 * through LedgerService.postEntry, this gate covers them at the backstop too.
 */
function makeLedger(periodsThrows: boolean) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const journals: any = {
    lockEntry: jest.fn(async () => true),
    getEntry: jest.fn(async () => ({ id: 'e1', entryNo: 7, postingDate: '2026-05-10', sourceType: 'manual', currency: 'EUR', lines: [] })),
    isReversed: jest.fn(async () => false),
    nextEntryNo: jest.fn(async () => 8),
    insertEntry: jest.fn(async () => 'rev1'),
    insertLines: jest.fn(async () => undefined),
  };
  const audit: any = { append: jest.fn(async () => undefined) };
  // Posting AND reversal gate on the caller's write transaction (assertOpenTx). assertOpen (separate
  // connection) must no longer be relied on by the ledger; the tests assert it is never called.
  const periods: any = {
    assertOpen: jest.fn(async (_d: string, what = 'Operation') => {
      if (periodsThrows) throw new PeriodLockedError(2026, 5, what);
    }),
    assertOpenTx: jest.fn(async (_db: any, _d: string, what = 'Operation') => {
      if (periodsThrows) throw new PeriodLockedError(2026, 5, what);
    }),
  };
  // No idempotency key is supplied in these gate tests, so the IdempotencyRepository is never called.
  const idem: any = { claim: jest.fn(), complete: jest.fn() };
  return { svc: new LedgerService(ctx, db, journals, idem, audit, periods), periods };
}

describe('Ledger period gate (Task 4.3)', () => {
  it('BLOCKS a posting whose date is in a locked period', async () => {
    const { svc, periods } = makeLedger(true);
    await expect(svc.postEntry({ postingDate: '2026-05-10', lines: [
      { accountId: 'a', direction: 'debit', amount: '10.00' },
      { accountId: 'b', direction: 'credit', amount: '10.00' },
    ] })).rejects.toBeInstanceOf(PeriodLockedError);
    expect(periods.assertOpenTx).toHaveBeenCalledWith(expect.anything(), '2026-05-10', 'Posting');
  });

  it('BLOCKS reversing an entry that lives in a locked period', async () => {
    const { svc, periods } = makeLedger(true);
    await expect(svc.reverseEntry('e1', 'fix')).rejects.toBeInstanceOf(PeriodLockedError);
    expect(periods.assertOpenTx).toHaveBeenCalledWith(expect.anything(), '2026-05-10', 'Reversal');
    expect(periods.assertOpen).not.toHaveBeenCalled();
  });

  it('gates a reversal on the original\'s CALENDAR date when node-pg returns a DATE as a local-midnight Date', async () => {
    // node-pg parses a DATE column as new Date(y, m, d) (LOCAL midnight). toISOString() would shift
    // it to the previous day east of UTC (Europe/Sofia: 2026-06-01 → 2026-05-31, the wrong period).
    const { svc, periods } = makeLedger(true);
    const journals = (svc as unknown as { journals: { getEntry: jest.Mock } }).journals;
    journals.getEntry.mockResolvedValueOnce({ id: 'e1', entryNo: 7, postingDate: new Date(2026, 5, 1), sourceType: 'manual', currency: 'EUR', lines: [] });
    await expect(svc.reverseEntry('e1', 'fix')).rejects.toBeInstanceOf(PeriodLockedError);
    expect(periods.assertOpenTx).toHaveBeenCalledWith(expect.anything(), '2026-06-01', 'Reversal');
  });

  it('does not reach the gate-throw when the period is open (gate consulted, no error)', async () => {
    const { svc, periods } = makeLedger(false);
    // postEntry will proceed past the gate; we only assert the gate was consulted
    // with the posting date (full happy-path posting is covered by the DB-backed
    // ledger suite).
    await svc.postEntry({ postingDate: '2026-07-01', lines: [
      { accountId: 'a', direction: 'debit', amount: '10.00' },
      { accountId: 'b', direction: 'credit', amount: '10.00' },
    ] }).catch(() => undefined);
    expect(periods.assertOpenTx).toHaveBeenCalledWith(expect.anything(), '2026-07-01', 'Posting');
  });

  it('reversal gate runs INSIDE the write transaction, before the reversing entry is inserted', async () => {
    const { svc, periods } = makeLedger(false);
    const journals = (svc as unknown as { journals: Record<string, jest.Mock> }).journals;
    await svc.reverseEntry('e1', 'fix');
    expect(journals.lockEntry.mock.invocationCallOrder[0]).toBeLessThan(periods.assertOpenTx.mock.invocationCallOrder[0]);
    expect(periods.assertOpenTx.mock.invocationCallOrder.at(-1)).toBeLessThan(journals.insertEntry.mock.invocationCallOrder[0]);
    // the reversal is posted on the same date that was gated
    const gated = periods.assertOpenTx.mock.calls.map((c: unknown[]) => c[1]);
    expect(gated).toContain(journals.insertEntry.mock.calls[0][1].postingDate);
  });

  it('refuses to reverse a payment settlement entry through the ledger API', async () => {
    const { svc } = makeLedger(false);
    const journals = (svc as unknown as { journals: { getEntry: jest.Mock; insertEntry: jest.Mock } }).journals;
    journals.getEntry.mockResolvedValueOnce({ id: 'e1', entryNo: 7, postingDate: '2026-05-10', sourceType: 'payment', currency: 'EUR', lines: [] });
    await expect(svc.reverseEntry('e1', 'fix')).rejects.toMatchObject({ name: 'SettlementReversalNotAllowedError' });
    expect(journals.insertEntry).not.toHaveBeenCalled();
  });
});
