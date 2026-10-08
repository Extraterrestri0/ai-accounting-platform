import { ViesService } from '../../src/modules/vies/application/vies.service';
import { InvalidVatNumberError } from '../../src/modules/vies/domain/errors';

function make(overrides: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const audit: any = { append: jest.fn(async () => undefined) };
  const repo: any = {
    latestFresh: jest.fn(async () => null),
    latestForVat: jest.fn(async () => null),
    insert: jest.fn(async (_db: any, _t: string, _c: string, c: any) => ({ id: 'chk1', ...c })),
    counterpartyVat: jest.fn(async () => ({ id: 'cp1', name: 'ACME', vatNumber: 'DE123456789', countryCode: 'DE' })),
    euInvoicesForMonth: jest.fn(async () => []),
    ...overrides.repo,
  };
  const provider: any = { check: jest.fn(async () => ({ valid: true, source: 'format', name: 'ACME GmbH' })), ...overrides.provider };
  const svc = new ViesService(ctx, db, repo, provider, audit);
  return { svc, repo, provider, audit };
}

describe('ViesService — validation flow (Task 4.2)', () => {
  it('validates a VALID EU VAT number live, stores it, and audits completion', async () => {
    const { svc, repo, provider, audit } = make();
    const r = await svc.validateVatNumber({ vatNumber: 'DE 123 456 789' });
    expect(r).toMatchObject({ vatNumber: 'DE123456789', countryCode: 'DE', valid: true, fromCache: false });
    expect(provider.check).toHaveBeenCalledWith({ normalized: 'DE123456789', countryCode: 'DE' });
    expect(repo.insert).toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'vies.validation_completed' }));
  });

  it('reports an INVALID number when the provider says so', async () => {
    const { svc } = make({ provider: { check: jest.fn(async () => ({ valid: false, source: 'live' })) } });
    const r = await svc.validateVatNumber({ vatNumber: 'DE000000000', force: true });
    expect(r.valid).toBe(false);
  });

  it('rejects a non-EU / malformed VAT number', async () => {
    const { svc, provider } = make();
    await expect(svc.validateVatNumber({ vatNumber: 'US123456789' })).rejects.toBeInstanceOf(InvalidVatNumberError);
    expect(provider.check).not.toHaveBeenCalled();
  });

  it('returns a CACHE HIT without calling the provider', async () => {
    const cached = { id: 'c0', vatNumber: 'DE123456789', countryCode: 'DE', isValid: true, checkedAt: '2026-06-01T00:00:00Z', expiresAt: '2026-07-01T00:00:00Z', responsePayload: { name: 'ACME' } };
    const { svc, provider, repo } = make({ repo: { latestFresh: jest.fn(async () => cached) } });
    const r = await svc.validateVatNumber({ vatNumber: 'DE123456789' });
    expect(r).toMatchObject({ valid: true, fromCache: true, source: 'cache' });
    expect(provider.check).not.toHaveBeenCalled();
    expect(repo.latestFresh).toHaveBeenCalledWith(expect.anything(), 'c1', 'DE123456789', expect.any(String)); // company-scoped
  });

  it('REVALIDATES live when the cache is empty/expired (latestFresh → null)', async () => {
    const { svc, provider } = make({ repo: { latestFresh: jest.fn(async () => null) } });
    await svc.validateVatNumber({ vatNumber: 'DE123456789' });
    expect(provider.check).toHaveBeenCalled();
  });

  it('refreshValidation forces a live check (bypasses cache)', async () => {
    const { svc, provider, repo } = make();
    await svc.refreshValidation('cp1');
    expect(repo.counterpartyVat).toHaveBeenCalled();
    expect(repo.latestFresh).not.toHaveBeenCalled(); // force=true skips the cache
    expect(provider.check).toHaveBeenCalled();
  });
});

describe('ViesService — dataset (Task 4.2)', () => {
  it('builds a signed monthly dataset (credit notes negative) and audits generation', async () => {
    const invoices = [
      { invoiceId: 'i1', invoiceNumber: '2026-0001', invoiceDate: '2026-05-04', netTotal: '1000.00', currency: 'EUR', documentKind: 'invoice', counterpartyId: 'cp1', counterpartyName: 'ACME GmbH', vatNumber: 'DE123456789', countryCode: 'DE' },
      { invoiceId: 'i2', invoiceNumber: '2026-0002', invoiceDate: '2026-05-09', netTotal: '200.00', currency: 'EUR', documentKind: 'credit_note', counterpartyId: 'cp1', counterpartyName: 'ACME GmbH', vatNumber: 'DE123456789', countryCode: 'DE' },
    ];
    const { svc, audit } = make({ repo: { euInvoicesForMonth: jest.fn(async () => invoices) } });
    const ds = await svc.buildViesDataset(2026, 5);
    expect(ds.count).toBe(2);
    expect(ds.rows[0].taxableAmount).toBe('1000.00');
    expect(ds.rows[1].taxableAmount).toBe('-200.00');
    expect(ds.totalTaxable).toBe('800.00');
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'vies.dataset_generated' }));
  });
});
