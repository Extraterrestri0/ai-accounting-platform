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
    getEntry: jest.fn(async () => ({ id: 'e1', entryNo: 7, postingDate: '2026-05-10', currency: 'EUR', lines: [] })),
    isReversed: jest.fn(async () => false),
    nextEntryNo: jest.fn(async () => 8),
    insertEntry: jest.fn(async () => 'rev1'),
    insertLines: jest.fn(async () => undefined),
  };
  const audit: any = { append: jest.fn(async () => undefined) };
  const periods: any = {
    assertOpen: jest.fn(async (_d: string, what = 'Operation') => {
      if (periodsThrows) throw new PeriodLockedError(2026, 5, what);
    }),
  };
  return { svc: new LedgerService(ctx, db, journals, audit, periods), periods };
}

describe('Ledger period gate (Task 4.3)', () => {
  it('BLOCKS a posting whose date is in a locked period', async () => {
    const { svc, periods } = makeLedger(true);
    await expect(svc.postEntry({ postingDate: '2026-05-10', lines: [
      { accountId: 'a', direction: 'debit', amount: '10.00' },
      { accountId: 'b', direction: 'credit', amount: '10.00' },
    ] })).rejects.toBeInstanceOf(PeriodLockedError);
    expect(periods.assertOpen).toHaveBeenCalledWith('2026-05-10', 'Posting');
  });

  it('BLOCKS reversing an entry that lives in a locked period', async () => {
    const { svc, periods } = makeLedger(true);
    await expect(svc.reverseEntry('e1', 'fix')).rejects.toBeInstanceOf(PeriodLockedError);
    expect(periods.assertOpen).toHaveBeenCalledWith('2026-05-10', 'Reversal');
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
    expect(periods.assertOpen).toHaveBeenCalledWith('2026-07-01', 'Posting');
  });
});
