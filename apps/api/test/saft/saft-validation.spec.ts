import { SaftValidationService } from '../../src/modules/saft/application/saft-validation.service';

// A complete (empty-period) dataset so the REAL domain validator runs end-to-end.
const fakeDataset: any = {
  header: { companyName: 'X', vatNumber: 'BG1', period: { year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' }, currency: 'EUR', softwareName: 'x', softwareVersion: '1', generatedAt: 'now' },
  masterFiles: { customers: [], suppliers: [], products: [], accounts: [], taxCodes: [{ vatCode: 'STD20', vatRate: '20', vatTreatment: 'standard', direction: 'both', saftTaxCode: 'S' }] },
  generalLedgerEntries: [],
  sourceDocuments: { salesInvoices: [], purchaseDocuments: [], payments: [] },
  counts: { customers: 0, suppliers: 0, products: 0, accounts: 0, taxCodes: 1, glEntries: 0, salesInvoices: 0, purchaseDocuments: 0, payments: 0 },
};

function make() {
  const ctx: any = { currentOrThrow: jest.fn(() => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' })) };
  const builder: any = { buildDataset: jest.fn(async () => fakeDataset) };
  const svc = new SaftValidationService(ctx, builder);
  return { svc, ctx, builder };
}

describe('SaftValidationService.validatePeriod (Task: SAF-T v1 — H1)', () => {
  it('builds the dataset and returns the validation summary', async () => {
    const { svc, builder } = make();
    const summary = await svc.validatePeriod(2026, 5);
    expect(builder.buildDataset).toHaveBeenCalledWith(2026, 5);
    expect(summary.ok).toBe(true);
  });

  it('is side-effect free: it does NOT depend on or write to audit/db (GET safety)', () => {
    // The constructor now takes only (ctx, builder) — there is no audit or db dependency
    // to write through. This structurally guarantees a GET validate cannot mutate state.
    expect(SaftValidationService.length).toBe(2);
    const { svc } = make();
    expect((svc as unknown as { audit?: unknown }).audit).toBeUndefined();
    expect((svc as unknown as { db?: unknown }).db).toBeUndefined();
  });

  it('fails closed when there is no tenant context', async () => {
    const ctx: any = { currentOrThrow: jest.fn(() => { throw new Error('MissingTenantContext'); }) };
    const builder: any = { buildDataset: jest.fn() };
    const svc = new SaftValidationService(ctx, builder);
    await expect(svc.validatePeriod(2026, 5)).rejects.toThrow();
    expect(builder.buildDataset).not.toHaveBeenCalled();
  });
});
