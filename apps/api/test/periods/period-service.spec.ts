import { AccountingPeriodService } from '../../src/modules/periods/application/period.service';
import { PeriodLockedError } from '../../src/modules/periods/domain/errors';

/** Build the service with in-memory fakes (no DB). */
function makeService(findResult: any) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const repo: any = {
    find: jest.fn(async () => findResult),
    list: jest.fn(async () => []),
    upsert: jest.fn(async () => undefined),
    gateShared: jest.fn(async () => undefined),
    gateExclusive: jest.fn(async () => undefined),
  };
  const audit: any = { append: jest.fn(async () => undefined) };
  const svc = new AccountingPeriodService(ctx, db, repo, audit);
  return { svc, repo, audit };
}

describe('AccountingPeriodService — gate (Task 4.3)', () => {
  it('assertOpen passes when the period is OPEN (no row)', async () => {
    const { svc } = makeService(null);
    await expect(svc.assertOpen('2026-05-10', 'Posting')).resolves.toBeUndefined();
  });

  it('assertOpen passes when an explicit OPEN row exists', async () => {
    const { svc } = makeService({ status: 'open', year: 2026, month: 5 });
    await expect(svc.assertOpen('2026-05-10')).resolves.toBeUndefined();
  });

  it('assertOpen THROWS PeriodLockedError when the period is LOCKED', async () => {
    const { svc } = makeService({ status: 'locked', year: 2026, month: 5 });
    await expect(svc.assertOpen('2026-05-10', 'Posting')).rejects.toBeInstanceOf(PeriodLockedError);
  });

  it('isPeriodLocked reflects the stored status', async () => {
    expect(await makeService({ status: 'locked' }).svc.isPeriodLocked(2026, 5)).toBe(true);
    expect(await makeService({ status: 'open' }).svc.isPeriodLocked(2026, 5)).toBe(false);
    expect(await makeService(null).svc.isPeriodLocked(2026, 5)).toBe(false);
  });
});

describe('AccountingPeriodService — lock / unlock flow (Task 4.3)', () => {
  it('lockPeriod upserts locked + emits period.locked', async () => {
    const { svc, repo, audit } = makeService({ status: 'locked', year: 2026, month: 5 });
    const p = await svc.lockPeriod(2026, 5);
    expect(repo.upsert).toHaveBeenCalledWith(expect.anything(), 't1', 'c1', 2026, 5, 'locked', 'u1');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'period.locked', actorId: 'u1' }));
    expect(p.status).toBe('locked');
  });

  it('openPeriod upserts open + emits period.opened', async () => {
    const { svc, repo, audit } = makeService({ status: 'open', year: 2026, month: 5 });
    const p = await svc.openPeriod(2026, 5);
    expect(repo.upsert).toHaveBeenCalledWith(expect.anything(), 't1', 'c1', 2026, 5, 'open', 'u1');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'period.opened' }));
    expect(p.status).toBe('open');
  });

  it('rejects an invalid month', async () => {
    const { svc } = makeService(null);
    await expect(svc.lockPeriod(2026, 13)).rejects.toThrow();
  });
});

describe('AccountingPeriodService — period-gate serialization (Pass 1A)', () => {
  it('assertOpenTx takes the SHARED gate lock BEFORE reading the period status', async () => {
    const { svc, repo } = makeService(null);
    await svc.assertOpenTx({} as any, '2026-05-10', 'Posting');
    expect(repo.gateShared).toHaveBeenCalledWith(expect.anything(), 'c1', 2026, 5);
    expect(repo.gateShared.mock.invocationCallOrder[0]).toBeLessThan(repo.find.mock.invocationCallOrder[0]);
  });

  it('assertOpenTx refuses a locked period (read after the gate)', async () => {
    const { svc } = makeService({ status: 'locked' });
    await expect(svc.assertOpenTx({} as any, '2026-05-10', 'Posting')).rejects.toBeInstanceOf(PeriodLockedError);
  });

  it('lockPeriod takes the EXCLUSIVE gate lock BEFORE writing locked', async () => {
    const { svc, repo } = makeService(null);
    await svc.lockPeriod(2026, 5);
    expect(repo.gateExclusive).toHaveBeenCalledWith(expect.anything(), 'c1', 2026, 5);
    expect(repo.gateExclusive.mock.invocationCallOrder[0]).toBeLessThan(repo.upsert.mock.invocationCallOrder[0]);
  });
});
