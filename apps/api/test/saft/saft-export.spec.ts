import { SaftExportService } from '../../src/modules/saft/application/saft-export.service';
import type { SaftDataset } from '../../src/modules/saft/domain/models';

/** Complete dataset so the real buildSaftXml (invoked by processExport) renders cleanly. */
function dataset(): SaftDataset {
  return {
    header: { companyName: 'ACME', eik: '123', vatNumber: 'BG123', period: { year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' }, currency: 'EUR', softwareName: 'sw', softwareVersion: '1', generatedAt: '2026-06-01T00:00:00.000Z' },
    masterFiles: { customers: [], suppliers: [], products: [], accounts: [], taxCodes: [] },
    generalLedgerEntries: [],
    sourceDocuments: { salesInvoices: [], purchaseDocuments: [], payments: [] },
    counts: { customers: 0, suppliers: 0, products: 0, accounts: 0, taxCodes: 0, glEntries: 0, salesInvoices: 0, purchaseDocuments: 0, payments: 0 },
  };
}
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
    insertArtifact: jest.fn(async (_db: any, _t: string, _c: string, a: any) => a.id),
    latestArtifact: jest.fn(async () => null),
    getExport: jest.fn(async (_db: any, id: string) => ({ id, year: 2026, month: 5, status: id.includes('failed') ? 'failed' : id.includes('queued') ? 'queued' : 'generated', generatedAt: 'now' })),
    getExportDataset: jest.fn(async () => dataset()),
    listExports: jest.fn(async () => []),
    ...over.repo,
  };
  const builder: any = { buildDataset: jest.fn(async () => dataset()), ...over.builder };
  const validation: any = { validateDataset: jest.fn(() => okSummary) };
  const queue: any = { enqueue: jest.fn(async () => undefined), ...over.queue };
  const storage: any = { putObject: jest.fn(async (_k: string, b: Buffer) => ({ sizeBytes: b.length, retainUntil: '2036-01-01T00:00:00.000Z' })), getDownloadUrl: jest.fn(async () => 'https://signed/url'), ...over.storage };
  const xsd: any = { isConfigured: jest.fn(() => false), validate: jest.fn(async () => ({ ok: null, errors: [], schemaVersion: null })), ...over.xsd };
  const svc = new SaftExportService(ctx, db, repo, builder, validation, audit, queue, storage, xsd);
  return { svc, repo, audit, builder, queue, storage, xsd };
}

describe('SaftExportService — v1 synchronous (no regression)', () => {
  it('generateExport persists a GENERATED export and audits it', async () => {
    const { svc, repo, audit } = make();
    const rec = await svc.generateExport(2026, 5);
    expect(repo.insertExport).toHaveBeenCalledWith(expect.anything(), 't1', 'c1', expect.objectContaining({ status: 'generated', year: 2026, month: 5 }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_generated' }));
    expect(rec.status).toBe('generated');
  });

  it('does NOT touch storage or the XSD validator on the v1 path (Phase 5 is async-only)', async () => {
    const { svc, storage, xsd } = make();
    await svc.generateExport(2026, 5);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(xsd.validate).not.toHaveBeenCalled();
  });
});

describe('SaftExportService — v2 requestExport (async)', () => {
  it('creates a queued export, audits "requested", enqueues', async () => {
    const { svc, repo, queue } = make();
    const rec = await svc.requestExport(2026, 5);
    expect(repo.insertQueued).toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith({ exportId: 'exp-queued', tenantId: 't1', companyId: 'c1' });
    expect(rec.status).toBe('queued');
  });
  it('duplicate-submit protection reuses an in-flight export', async () => {
    const existing = { id: 'exp-existing', year: 2026, month: 5, status: 'processing', generatedAt: 'now' };
    const { svc, repo, queue } = make({ repo: { findActiveExport: jest.fn(async () => existing) } });
    expect(await svc.requestExport(2026, 5)).toBe(existing);
    expect(repo.insertQueued).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});

describe('SaftExportService — processExport (Phase 5: XML + XSD + storage)', () => {
  it('renders XML, stores a WORM artifact, persists sha256/size/key, completes + audits', async () => {
    const { svc, repo, audit, storage } = make();
    await svc.processExport('exp-1');
    // stored to a company/period/export-scoped key, WORM (xsd_valid null ⇒ not invalid)
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^saft\/c1\/2026-05\/exp-1\/[0-9a-f-]{36}\.xml$/),
      expect.any(Buffer), 'application/xml', { worm: true });
    const artifact = repo.insertArtifact.mock.calls[0][3];
    expect(artifact).toMatchObject({ kind: 'xml', contentType: 'application/xml', xsdValid: null });
    expect(artifact.sizeBytes).toBeGreaterThan(0);
    expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.markCompleted).toHaveBeenCalledWith(expect.anything(), 'exp-1', expect.objectContaining({ xsdValid: null }));
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_generated' }));
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('xsd_valid = null is persisted when no schema is configured', async () => {
    const { svc, repo } = make(); // default xsd → ok:null
    await svc.processExport('exp-2');
    expect(repo.insertArtifact.mock.calls[0][3]).toMatchObject({ xsdValid: null, xsdErrors: [] });
    expect(repo.markCompleted).toHaveBeenCalledWith(expect.anything(), 'exp-2', expect.objectContaining({ xsdValid: null }));
  });

  it('persists an INVALID xsd result (xsd_valid=false + errors) and does NOT WORM-lock it', async () => {
    const errors = [{ message: 'element not expected', line: 2 }];
    const { svc, repo, storage } = make({ xsd: { validate: jest.fn(async () => ({ ok: false, errors, schemaVersion: 'tiny-1.0' })) } });
    await svc.processExport('exp-3');
    expect(storage.putObject).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), 'application/xml', { worm: false });
    expect(repo.insertArtifact.mock.calls[0][3]).toMatchObject({ xsdValid: false, xsdErrors: errors });
    expect(repo.markCompleted).toHaveBeenCalledWith(expect.anything(), 'exp-3', expect.objectContaining({ xsdValid: false, schemaVersion: 'tiny-1.0' }));
  });

  it('storage write failure marks the export FAILED (no artifact, no completion)', async () => {
    const { svc, repo, audit } = make({ storage: { putObject: jest.fn(async () => { throw new Error('s3 down'); }) } });
    await expect(svc.processExport('exp-4')).rejects.toThrow('s3 down');
    expect(repo.markFailed).toHaveBeenCalledWith(expect.anything(), 'exp-4', 's3 down');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_failed' }));
    expect(repo.insertArtifact).not.toHaveBeenCalled();
    expect(repo.markCompleted).not.toHaveBeenCalled();
  });

  it('idempotent: a non-claimable delivery is a no-op (no render/store)', async () => {
    const { svc, repo, storage } = make({ repo: { claimForProcessing: jest.fn(async () => false) } });
    await svc.processExport('exp-5');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(repo.insertArtifact).not.toHaveBeenCalled();
  });
});

describe('SaftExportService — getDownloadUrl (Phase 5)', () => {
  it('issues a short-lived signed URL for the latest XML artifact and audits the download', async () => {
    const art = { id: 'art-1', storageKey: 'saft/c1/2026-05/exp-1/art-1.xml', contentType: 'application/xml', sizeBytes: 10 };
    const { svc, storage, audit } = make({ repo: { latestArtifact: jest.fn(async () => art) } });
    const dl = await svc.getDownloadUrl('exp-1');
    expect(storage.getDownloadUrl).toHaveBeenCalledWith(art.storageKey, 300);
    expect(dl).toEqual({ url: 'https://signed/url', filename: 'saft-exp-1.xml', expiresInSeconds: 300 });
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'saft.export_downloaded', entityId: 'exp-1' }));
  });

  it('returns null (and does not audit) when there is no artifact', async () => {
    const { svc, audit } = make({ repo: { latestArtifact: jest.fn(async () => null) } });
    expect(await svc.getDownloadUrl('exp-x')).toBeNull();
    expect(audit.append).not.toHaveBeenCalled();
  });
});
