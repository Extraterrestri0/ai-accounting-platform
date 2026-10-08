import { SaftDatasetBuilder } from '../../src/modules/saft/application/saft-dataset.builder';

// e1: a sales (invoice) entry. pe7: a clean purchase. pe9 + pe9r: a purchase that was
// later REVERSED — BOTH the original (pe9) and its reversal (pe9r) must be excluded (#7).
const PURCHASE_LINES = [
  { lineNumber: 1, accountCode: '602', debit: '200.00', credit: '0.00' },
  { lineNumber: 2, accountCode: '4531', debit: '40.00', credit: '0.00' },
  { lineNumber: 3, accountCode: '401', debit: '0.00', credit: '240.00' },
];
const GL_ENTRIES = [
  { journalEntryId: 'e1', entryNo: 1, postingDate: '2026-05-10', documentReference: 'INV-1', sourceType: 'invoice', sourceId: undefined, reversesEntryId: undefined, lines: [{ lineNumber: 1, accountCode: '411', debit: '120.00', credit: '0.00' }] },
  { journalEntryId: 'pe7', entryNo: 7, postingDate: '2026-05-12', sourceType: 'review', sourceId: 'rp7', reversesEntryId: undefined, lines: PURCHASE_LINES },
  { journalEntryId: 'pe9', entryNo: 9, postingDate: '2026-05-12', sourceType: 'review', sourceId: 'rp9', reversesEntryId: undefined, lines: PURCHASE_LINES },
  { journalEntryId: 'pe9r', entryNo: 10, postingDate: '2026-05-13', sourceType: 'review', sourceId: 'rp9', reversesEntryId: 'pe9', lines: PURCHASE_LINES.map((l) => ({ ...l, debit: l.credit, credit: l.debit })) },
];

function make(over: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const postings: any = {
    listPostedPurchaseDetails: jest.fn(async () => [
      { reviewPackageId: 'rp7', supplierName: 'Vendor GmbH', supplierId: 'sup1', classificationCategory: 'Външни услуги', accountingSuggestion: '602', approvalStatus: 'approved', documentNumber: 'INV-SUP-77', documentNet: '200.00', documentVat: '40.00', documentGross: '240.00' },
    ]),
    ...over.postings,
  };
  const repo: any = {
    companyInfo: jest.fn(async () => ({ name: 'ACME OOD', eik: '123456789', vatNumber: 'BG123456789', currency: 'EUR' })),
    customers: jest.fn(async () => [{ id: 'cust1', name: 'Beta', vatNumber: 'BG999', country: 'BG' }]),
    suppliers: jest.fn(async () => [{ id: 'sup1', name: 'Vendor GmbH', country: 'DE' }]),
    products: jest.fn(async () => [{ code: 'P1', description: 'Service', unit: 'pcs', vatRate: '20', kind: 'service', saftCode: 'SVC' }]),
    accounts: jest.fn(async () => [{ accountCode: '702', accountName: 'Revenue', accountType: 'revenue' }]),
    taxCodes: jest.fn(async () => [{ vatCode: 'STD20', vatRate: '20', vatTreatment: 'standard', direction: 'both' }]),
    glEntries: jest.fn(async () => GL_ENTRIES),
    salesInvoices: jest.fn(async () => [{ invoiceNumber: '2026-0001', invoiceDate: '2026-05-10', customer: 'Beta', netAmount: '100.00', vatAmount: '20.00', grossAmount: '120.00', documentType: 'invoice', vatCode: 'STD20' }]),
    payments: jest.fn(async () => [{ paymentDate: '2026-05-15', amount: '120.00', direction: 'inbound', counterparty: 'Beta', linkedDocumentType: 'sales_invoice', linkedDocumentId: 'inv1', bankReference: 'REF', reconciliationStatus: 'reconciled' }]),
    ...over.repo,
  };
  return { svc: new SaftDatasetBuilder(ctx, db, repo, postings), repo, postings };
}

describe('SaftDatasetBuilder (SAF-T)', () => {
  it('builds the header from company info + period', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.header).toMatchObject({ companyName: 'ACME OOD', eik: '123456789', vatNumber: 'BG123456789', currency: 'EUR' });
    expect(ds.header.period).toEqual({ year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' });
  });

  it('extracts master files', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.masterFiles.customers[0]).toMatchObject({ id: 'cust1', name: 'Beta' });
    expect(ds.masterFiles.products[0].code).toBe('P1');
    expect(ds.masterFiles.taxCodes[0].vatCode).toBe('STD20');
  });

  it('keeps all GL entries (incl. reversals) in the ledger section', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.generalLedgerEntries).toHaveLength(4);
  });

  it('purchase docs: real supplier doc number (#2), derived amounts (#4), reversed pair excluded (#7)', async () => {
    const { svc, postings } = make();
    const ds = await svc.buildDataset(2026, 5);
    // only the clean purchase rp7 is enriched — pe9 (reversed) and pe9r (reversal) are excluded
    expect(postings.listPostedPurchaseDetails).toHaveBeenCalledTimes(1);
    expect(postings.listPostedPurchaseDetails).toHaveBeenCalledWith(['rp7']);
    expect(ds.sourceDocuments.purchaseDocuments).toHaveLength(1);
    expect(ds.sourceDocuments.purchaseDocuments[0]).toMatchObject({
      documentNumber: 'INV-SUP-77', // real supplier doc number, not '#7'
      netAmount: '200.00', vatAmount: '40.00', grossAmount: '240.00',
      supplier: 'Vendor GmbH', supplierId: 'sup1', approvalStatus: 'approved',
    });
  });

  it('falls back to #<entryNo> and ledger-derived gross when the document is absent', async () => {
    const { svc } = make({ postings: { listPostedPurchaseDetails: jest.fn(async () => [{ reviewPackageId: 'rp7', supplierName: 'Vendor GmbH' }]) } });
    const ds = await svc.buildDataset(2026, 5);
    expect(ds.sourceDocuments.purchaseDocuments[0]).toMatchObject({ documentNumber: '#7', grossAmount: '240.00', vatAmount: '0.00', netAmount: '240.00' });
  });

  it('does not call the docintel read-model when there are no purchases', async () => {
    const { svc, postings } = make({ repo: { glEntries: jest.fn(async () => [GL_ENTRIES[0]]) } }); // invoice only
    const ds = await svc.buildDataset(2026, 5);
    expect(postings.listPostedPurchaseDetails).not.toHaveBeenCalled();
    expect(ds.sourceDocuments.purchaseDocuments).toHaveLength(0);
  });

  it('reports section counts', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.counts).toMatchObject({ glEntries: 4, salesInvoices: 1, purchaseDocuments: 1, payments: 1 });
  });

  it('reads every section scoped to the active company', async () => {
    const { svc, repo } = make();
    await svc.buildDataset(2026, 5);
    expect(repo.glEntries).toHaveBeenCalledWith(expect.anything(), 'c1', '2026-05-01', '2026-05-31');
    expect(repo.customers).toHaveBeenCalledWith(expect.anything(), 'c1');
  });

  it('rejects an invalid month', async () => {
    await expect(make().svc.buildDataset(2026, 13)).rejects.toThrow();
  });
});
