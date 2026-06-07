import { SaftExportService } from '../../src/modules/saft/application/saft-export.service';

const fakeDataset: any = { header: {}, masterFiles: {}, generalLedgerEntries: [], sourceDocuments: {}, counts: { glEntries: 0 } };
const okSummary: any = { ok: true, errors: [], warnings: [], info: [], counts: { errors: 0, warnings: 0, info: 0 } };

function make(over: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const audit: any = { append: jest.fn(async () => undefined) };
  const repo: any = {
    insertExport: jest.fn(async (_db: any, _t: string, _c: string, e: any) => `exp-${e.status}`),
    getExport: jest.fn(async (_db: any, id: string) => ({ id, year: 2026, month: 5, status: id.includes('failed') ? 'failed' : 'generated', generatedAt: 'now' })),
    getExportDataset: jest.fn(async () => fakeDataset),
    listExports: jest.fn(async () => []),
    ...over.repo,
  };
  const builder: any = { buildDataset: jest.fn(async () => fakeDataset), ...over.builder };
  const validation: any = { validateDataset: jest.fn(() => okSummary) };
  const svc = new SaftExportService(ctx, db, repo, builder, validation, audit);
  return { svc, repo, audit, builder };
}

describe('SaftExportService (Task: SAF-T v1)', () => {
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
