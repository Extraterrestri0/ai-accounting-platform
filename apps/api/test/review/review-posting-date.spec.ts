/**
 * Review-side posting-date regression tests (Finding E): the extracted date is proposed to the
 * reviewer, a human can confirm/correct it, the confirmed value is persisted, invalid dates are
 * rejected, and decisions remain human-only. Deterministic (no machine-clock dependency).
 */
import 'reflect-metadata';
import { ReviewService } from '../../src/modules/docintel/application/review.service';

function makeService(pkg: Record<string, unknown>, fields: { key: string; valueText?: string }[] = []) {
  const ctx = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: pkg.__noHuman ? undefined : 'u1' }) } as any;
  const db = { run: (fn: (d: unknown) => unknown) => Promise.resolve(fn({})) } as any;
  const repo = {
    getById: jest.fn(async () => pkg),
    getByDocument: jest.fn(async () => pkg),
    setPostingDate: jest.fn(async () => undefined),
    setDecision: jest.fn(async () => undefined),
    setCorrectedFields: jest.fn(async () => undefined),
    getCorrectedFields: jest.fn(async () => ({})),
    addAction: jest.fn(async () => undefined),
    listComments: jest.fn(async () => []),
    listActions: jest.fn(async () => []),
    markSuggestion: jest.fn(async () => undefined),
  } as any;
  const suggestions = { getCurrent: jest.fn(async () => null), accountIdByCode: jest.fn(async () => 'acc-1') } as any;
  const extraction = { getReviewPackage: jest.fn(async () => ({ overallConfidence: 0.9, fields, flags: [], diagnostics: [] })) } as any;
  const engine = { getSuggestion: jest.fn(async () => null) } as any;
  const documents = { getDownloadUrl: jest.fn(async () => 'u') } as any;
  const audit = { append: jest.fn(async () => undefined) } as any;
  const svc = new ReviewService(ctx, db, repo, suggestions, extraction, engine, documents, audit);
  return { svc, repo };
}

const basePkg = { id: 'rp-1', documentId: 'doc-1', status: 'pending', createdAt: '2026-01-01' };

describe('getDetail proposes a posting date from the extracted document', () => {
  it('proposes the extracted tax-event date when none is confirmed yet', async () => {
    const { svc } = makeService({ ...basePkg }, [
      { key: 'tax_event_date', valueText: '2026-09-30' },
      { key: 'invoice_date', valueText: '2026-09-28' },
    ]);
    const d = await svc.getDetail('doc-1');
    expect(d.proposedPostingDate).toBe('2026-09-30');
  });

  it('falls back to the invoice date when there is no tax-event date', async () => {
    const { svc } = makeService({ ...basePkg }, [{ key: 'invoice_date', valueText: '2026-09-28' }]);
    expect((await svc.getDetail('doc-1')).proposedPostingDate).toBe('2026-09-28');
  });

  it('prefers the already-confirmed date over the extracted one', async () => {
    const { svc } = makeService({ ...basePkg, approvedPostingDate: '2026-08-15' }, [{ key: 'tax_event_date', valueText: '2026-09-30' }]);
    expect((await svc.getDetail('doc-1')).proposedPostingDate).toBe('2026-08-15');
  });

  it('proposes nothing when the document carries no usable date (reviewer must enter it)', async () => {
    const { svc } = makeService({ ...basePkg }, [{ key: 'invoice_date', valueText: 'n/a' }]);
    expect((await svc.getDetail('doc-1')).proposedPostingDate).toBeUndefined();
  });
});

describe('human can confirm/correct the posting date (persisted)', () => {
  it('setPostingDate persists the confirmed value', async () => {
    const { svc, repo } = makeService({ ...basePkg });
    await svc.setPostingDate('rp-1', '2026-09-30');
    expect(repo.setPostingDate).toHaveBeenCalledWith(expect.anything(), 'rp-1', '2026-09-30');
  });

  it('setPostingDate rejects an invalid date and persists nothing', async () => {
    const { svc, repo } = makeService({ ...basePkg });
    await expect(svc.setPostingDate('rp-1', '30/09/2026')).rejects.toThrow(/valid date/i);
    expect(repo.setPostingDate).not.toHaveBeenCalled();
  });

  it('edit persists a corrected posting date through setDecision', async () => {
    const { svc, repo } = makeService({ ...basePkg });
    await svc.edit('rp-1', { postingDate: '2026-07-01' });
    expect(repo.setDecision).toHaveBeenCalledWith(expect.anything(), 'rp-1', 'pending', 'u1', expect.objectContaining({ postingDate: '2026-07-01' }));
  });

  it('approve carries the confirmed posting date', async () => {
    const { svc, repo } = makeService({ ...basePkg });
    await svc.approve('rp-1', undefined, '2026-09-30');
    expect(repo.setDecision).toHaveBeenCalledWith(expect.anything(), 'rp-1', 'approved', 'u1', expect.objectContaining({ postingDate: '2026-09-30' }));
  });

  it('approve rejects an invalid confirmed date', async () => {
    const { svc } = makeService({ ...basePkg });
    await expect(svc.approve('rp-1', undefined, 'today')).rejects.toThrow(/valid date/i);
  });
});

describe('decisions remain human-only', () => {
  it('setPostingDate refuses a non-human actor', async () => {
    const { svc } = makeService({ ...basePkg, __noHuman: true });
    await expect(svc.setPostingDate('rp-1', '2026-09-30')).rejects.toThrow(/human/i);
  });
  it('approve refuses a non-human actor (AI cannot approve)', async () => {
    const { svc } = makeService({ ...basePkg, __noHuman: true });
    await expect(svc.approve('rp-1')).rejects.toThrow(/human/i);
  });
});
