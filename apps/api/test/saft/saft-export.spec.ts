import { SaftExportService } from '../../src/modules/saft/application/saft-export.service';

const fakeDataset: any = { header: {}, masterFiles: {}, generalLedgerEntries: [], sourceDocuments: {}, counts: { glEntries: 0 } };
const okSummary: any = { ok: true, errors: [], warnings: [], info: [], counts: { errors: 0, warnings: 0, info: 0 } };

function make(over: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const audit: any = { append: jest.fn(async () => undefined) };
  const repo: any = {
    insertExport: jest.fn(async (_db: any, _t: string, _c: string, e: any) => `exp-${e.status}`),
    insertQueued: jest.fn(async () => 'exp-queued'),
    findActiveExport: jest.fn(async () => null),
    claimForProcessing: jest.fn(async () => true),
    markCompleted: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    getExport: jest.fn(async (_db: any, id: string) => ({ id, year: 2026, month: 5, status: id.includes('failed') ? 'failed' : id.includes('queued') ? 'queued' : 'generated', generatedAt: 'now' })),
    getExportDataset: jest.fn(async () => fakeDataset),
    listExports: jest.fn(async () => []),
    ...over.repo,
  };
  const builder: any = { buildDataset: jest.fn(async () => fakeDataset), ...over.builder };
  const validation: any = { validateDataset: jest.fn(() => okSummary) };
  const queue: any = { enqueue: jest.fn(async () => undefined), ...over.queue };
  const svc = new SaftExportService(ctx, db, repo, builder, validation, audit, queue);
  return { svc, repo, audit, builder, queue };
}

describe('SaftExportService — v1 synchronous (preserved)', () => {
  it('builds, validates, persists a GENERATED export and audits it', async () => {
    const { svc, repo, audit } = make();
    const rec = await svc.generateExport(2026, 5);
    expect(repo.insertExport).toHaveBeenCalledWith(expect.anything(), 't1', 'c1', expect.objectContaining({ status: 'generated', year: 2026, month: 5 }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_requested' }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_generated' }));
    expect(rec.status).toBe('generated');
  });

  it('persists a FAILED export when the builder throws (no exception bubbles)', async () => {
    const { svc, repo, audit } = make({ builder: { buildDataset: jest.fn(async () => { throw new Error('boom'); }) } });
    const rec = await svc.generateExport(2026, 5);
    expect(repo.insertExport).toHaveBeenCalledWith(expect.anything(), 't1', 'c1', expect.objectContaining({ status: 'failed', error: 'boom' }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_failed' }));
    expect(rec.status).toBe('failed');
  });

  it('returns the stored dataset for an export', async () => {
    const { svc } = make();
    expect(await svc.getExportDataset('exp-generated')).toBe(fakeDataset);
  });
});

describe('SaftExportService — v2 requestExport (async, Phase 2)', () => {
  it('creates a queued export, audits "requested", and enqueues a job', async () => {
    const { svc, repo, audit, queue } = make();
    const rec = await svc.requestExport(2026, 5);
    expect(repo.insertQueued).toHaveBeenCalledWith(expect.anything(), 't1', 'c1', expect.objectContaining({ year: 2026, month: 5, requestedBy: 'u1' }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_requested', entityId: 'exp-queued' }));
    expect(queue.enqueue).toHaveBeenCalledWith({ exportId: 'exp-queued', tenantId: 't1', companyId: 'c1' });
    expect(rec.status).toBe('queued');
  });

  it('duplicate-submit protection: reuses an in-flight export and does NOT insert or enqueue', async () => {
    const existing = { id: 'exp-existing', year: 2026, month: 5, status: 'processing', generatedAt: 'now' };
    const { svc, repo, audit, queue } = make({ repo: { findActiveExport: jest.fn(async () => existing) } });
    const rec = await svc.requestExport(2026, 5);
    expect(rec).toBe(existing);
    expect(repo.insertQueued).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });
});

describe('SaftExportService — v2 processExport (worker state machine)', () => {
  it('queued → processing → completed: claims, builds, validates, persists, audits generated', async () => {
    const { svc, repo, audit, builder } = make();
    await svc.processExport('exp-1');
    expect(repo.claimForProcessing).toHaveBeenCalledWith(expect.anything(), 'exp-1');
    expect(builder.buildDataset).toHaveBeenCalledWith(2026, 5);
    expect(repo.markCompleted).toHaveBeenCalledWith(expect.anything(), 'exp-1', expect.objectContaining({ datasetJson: fakeDataset }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_generated', actorType: 'system', entityId: 'exp-1' }));
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('failed transition: builder throws → markFailed + audit failed + rethrow (for retry)', async () => {
    const { svc, repo, audit } = make({ builder: { buildDataset: jest.fn(async () => { throw new Error('kaboom'); }) } });
    await expect(svc.processExport('exp-2')).rejects.toThrow('kaboom');
    expect(repo.markFailed).toHaveBeenCalledWith(expect.anything(), 'exp-2', 'kaboom');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_failed', actorType: 'system', entityId: 'exp-2' }));
    expect(repo.markCompleted).not.toHaveBeenCalled();
  });

  it('idempotent: a duplicate delivery that cannot claim (already processing/completed) is a no-op', async () => {
    const { svc, repo, builder } = make({ repo: { claimForProcessing: jest.fn(async () => false) } });
    await svc.processExport('exp-3');
    expect(builder.buildDataset).not.toHaveBeenCalled();
    expect(repo.markCompleted).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
  });
});
