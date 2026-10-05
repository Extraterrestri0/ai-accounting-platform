/**
 * Posting-date regression tests (Finding E). The document-driven review → post flow must use a
 * HUMAN-confirmed accounting date and must NEVER fall back to the server's current date.
 * These are deterministic (fixed dates, no dependency on the machine clock).
 */
import 'reflect-metadata';
import { parsePostingDate } from '../../src/modules/docintel/domain/posting/date';
import { PostingService } from '../../src/modules/docintel/application/posting.service';

describe('parsePostingDate', () => {
  it('accepts a strict YYYY-MM-DD calendar date', () => {
    expect(parsePostingDate('2026-09-30')).toBe('2026-09-30');
    expect(parsePostingDate('  2026-01-01 ')).toBe('2026-01-01');
  });
  it('rejects absent, non-string, wrong-format and impossible dates', () => {
    for (const v of [undefined, null, '', 'today', '30/09/2026', '2026-9-3', '2026-13-01', '2026-02-30', 123]) {
      expect(parsePostingDate(v as unknown)).toBeNull();
    }
  });
});

/* ---- PostingService.postFromReview: confirmed date in, no today fallback ---- */

const CONFIRMED = '2026-09-30';
const TODAY = new Date().toISOString().slice(0, 10);

type Opts = { approvedPostingDate?: string; noHuman?: boolean; alreadyPosted?: boolean; periodLocked?: boolean };
function makeService(o: Opts) {
  const ledgerPostEntry = jest.fn(async (input: { postingDate: string }) => ({ id: 'je-1', entryNo: 417, postingDate: input.postingDate }));
  const assertOpen = jest.fn(async (date: string) => { if (o.periodLocked) throw new Error(`Period for ${date} is locked`); });
  const ctx = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: o.noHuman ? undefined : 'u1' }) } as any;
  const fakeDb = { query: jest.fn(async (sql: string) => {
    if (/SELECT document_id FROM review_packages/.test(sql)) return { rows: [{ document_id: 'doc-1' }] };
    return { rows: [] };
  }) };
  const db = { run: (fn: (d: unknown) => unknown) => Promise.resolve(fn(fakeDb)) } as any;
  const repo = {
    hasPostedForReview: jest.fn(async () => !!o.alreadyPosted),
    accountIdByCode: jest.fn(async (_d: unknown, code: string) => ({ id: `acc-${code}`, isPostable: true })),
    createRequest: jest.fn(async () => 'req-1'),
    setRequestStatus: jest.fn(async () => undefined),
    addResult: jest.fn(async () => undefined),
  } as any;
  const reviews = {
    getDetail: jest.fn(async () => ({
      package: {
        id: 'rp-1', documentId: 'doc-1', status: 'approved',
        approvedPostingDate: o.approvedPostingDate,
        approvedPosting: [
          { accountCode: '602', side: 'debit', amount: '190.00' },
          { accountCode: '401', side: 'credit', amount: '190.00' },
        ],
      },
      suggestion: null,
    })),
  } as any;
  const audit = { append: jest.fn(async () => undefined) } as any;
  const periods = { assertOpen } as any;
  const ledger = { postEntry: ledgerPostEntry } as any;
  const svc = new PostingService(ctx, db, repo, reviews, ledger, audit, periods);
  return { svc, ledgerPostEntry, assertOpen, repo };
}

describe('postFromReview uses the confirmed posting date', () => {
  it('posts with the human-confirmed date, not today', async () => {
    expect(CONFIRMED).not.toBe(TODAY); // guard: the test is meaningful
    const { svc, ledgerPostEntry } = makeService({ approvedPostingDate: CONFIRMED });
    const out = await svc.postFromReview('rp-1');
    expect(ledgerPostEntry).toHaveBeenCalledTimes(1);
    expect(ledgerPostEntry.mock.calls[0][0].postingDate).toBe(CONFIRMED);
    expect(ledgerPostEntry.mock.calls[0][0].postingDate).not.toBe(TODAY);
    expect(out.journalEntryId).toBe('je-1');
  });

  it('checks the period for the CONFIRMED date (not today)', async () => {
    const { svc, assertOpen } = makeService({ approvedPostingDate: CONFIRMED });
    await svc.postFromReview('rp-1');
    expect(assertOpen).toHaveBeenCalledWith(CONFIRMED, 'Posting');
  });
});

describe('postFromReview fails closed', () => {
  it('refuses to post when no confirmed posting date exists (no today fallback)', async () => {
    const { svc, ledgerPostEntry } = makeService({ approvedPostingDate: undefined });
    await expect(svc.postFromReview('rp-1')).rejects.toThrow(/confirmed posting date/i);
    expect(ledgerPostEntry).not.toHaveBeenCalled();
  });

  it('refuses when the confirmed date is in a locked period (never moved to an open period)', async () => {
    const { svc, ledgerPostEntry } = makeService({ approvedPostingDate: CONFIRMED, periodLocked: true });
    await expect(svc.postFromReview('rp-1')).rejects.toThrow(/locked/i);
    expect(ledgerPostEntry).not.toHaveBeenCalled();
  });

  it('refuses a duplicate posting', async () => {
    const { svc, ledgerPostEntry } = makeService({ approvedPostingDate: CONFIRMED, alreadyPosted: true });
    await expect(svc.postFromReview('rp-1')).rejects.toThrow(/already been posted/i);
    expect(ledgerPostEntry).not.toHaveBeenCalled();
  });

  it('refuses when the actor is not human (AI/worker cannot post)', async () => {
    const { svc, ledgerPostEntry } = makeService({ approvedPostingDate: CONFIRMED, noHuman: true });
    await expect(svc.postFromReview('rp-1')).rejects.toThrow(/human|cannot post/i);
    expect(ledgerPostEntry).not.toHaveBeenCalled();
  });
});
