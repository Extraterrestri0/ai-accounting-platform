import { SaftDatasetBuilder } from '../../src/modules/saft/application/saft-dataset.builder';

// One invoice (sales) entry, one purchase entry posted from review, and one REVERSAL
// of a review entry — the reversal must NOT become a purchase source document.
const GL_ENTRIES = [
  { journalEntryId: 'e1', entryNo: 1, postingDate: '2026-05-10', documentReference: 'INV-1', sourceType: 'invoice', sourceId: undefined, reversesEntryId: undefined, lines: [{ lineNumber: 1, accountCode: '411', debit: '120.00', credit: '0.00' }] },
  { journalEntryId: 'pe7', entryNo: 7, postingDate: '2026-05-12', sourceType: 'review', sourceId: 'rp7', reversesEntryId: undefined, lines: [
    { lineNumber: 1, accountCode: '602', debit: '200.00', credit: '0.00' },
    { lineNumber: 2, accountCode: '4531', debit: '40.00', credit: '0.00' },
    { lineNumber: 3, accountCode: '401', debit: '0.00', credit: '240.00' },
  ] },
  { journalEntryId: 'pe7r', entryNo: 8, postingDate: '2026-05-13', sourceType: 'review', sourceId: 'rp7', reversesEntryId: 'pe7', lines: [
    { lineNumber: 1, accountCode: '602', debit: '0.00', credit: '200.00' },
    { lineNumber: 2, accountCode: '4531', debit: '0.00', credit: '40.00' },
    { lineNumber: 3, accountCode: '401', debit: '240.00', credit: '0.00' },
  ] },
];

function make(over: any = {}) {
  const ctx: any = { currentOrThrow: () => ({ tenantId: 't1', companyId: 'c1', userId: 'u1' }) };
  const db: any = { run: async (fn: any) => fn({}) };
  const masterdata: any = { getPostingAccounts: jest.fn(async () => ({ payable: '401', purchase_vat_input: '4531', cash_bank: '503', receivable: '411', sales_revenue: '702', sales_vat_output: '4532', purchase_expense_default: '602' })) };
  const postings: any = {
    listPostedPurchaseDetails: jest.fn(async () => [
      { reviewPackageId: 'rp7', supplierName: 'Vendor GmbH', supplierId: 'sup1', classificationCategory: 'Външни услуги', accountingSuggestion: '602', approvalStatus: 'approved' },
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
  return { svc: new SaftDatasetBuilder(ctx, db, repo, masterdata, postings), repo, masterdata, postings };
}

describe('SaftDatasetBuilder (Task: SAF-T v1)', () => {
  it('builds the header from company info + period', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.header).toMatchObject({ companyName: 'ACME OOD', eik: '123456789', vatNumber: 'BG123456789', currency: 'EUR' });
    expect(ds.header.period).toEqual({ year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' });
  });

  it('extracts master files (customers/suppliers/products/accounts/tax codes)', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.masterFiles.customers[0]).toMatchObject({ id: 'cust1', name: 'Beta' });
    expect(ds.masterFiles.suppliers[0]).toMatchObject({ name: 'Vendor GmbH', country: 'DE' });
    expect(ds.masterFiles.products[0].code).toBe('P1');
    expect(ds.masterFiles.taxCodes[0].vatCode).toBe('STD20');
  });

  it('extracts general ledger entries from the immutable ledger', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.generalLedgerEntries).toHaveLength(3);
    expect(ds.generalLedgerEntries[0]).toMatchObject({ journalEntryId: 'e1', sourceType: 'invoice' });
  });

  it('derives purchase docs from review GL entries + docintel enrichment (no purchase SQL in saft)', async () => {
    const { svc, postings } = make();
    const ds = await svc.buildDataset(2026, 5);
    // Enrichment is fetched in ONE batched call, keyed only by non-reversal review entries.
    expect(postings.listPostedPurchaseDetails).toHaveBeenCalledTimes(1);
    expect(postings.listPostedPurchaseDetails).toHaveBeenCalledWith(['rp7']);
    expect(ds.sourceDocuments.salesInvoices[0]).toMatchObject({ invoiceNumber: '2026-0001', grossAmount: '120.00' });
    expect(ds.sourceDocuments.purchaseDocuments).toHaveLength(1); // the reversal entry is excluded
    expect(ds.sourceDocuments.purchaseDocuments[0]).toMatchObject({
      documentNumber: '#7', netAmount: '200.00', vatAmount: '40.00', grossAmount: '240.00',
      supplier: 'Vendor GmbH', supplierId: 'sup1', approvalStatus: 'approved', classificationCategory: 'Външни услуги',
    });
    expect(ds.sourceDocuments.payments[0]).toMatchObject({ direction: 'inbound', reconciliationStatus: 'reconciled' });
  });

  it('does not call the docintel read-model when there are no purchases', async () => {
    const { svc, postings } = make({ repo: { glEntries: jest.fn(async () => [GL_ENTRIES[0]]) } }); // invoice only
    const ds = await svc.buildDataset(2026, 5);
    expect(postings.listPostedPurchaseDetails).not.toHaveBeenCalled();
    expect(ds.sourceDocuments.purchaseDocuments).toHaveLength(0);
  });

  it('reports section counts', async () => {
    const ds = await make().svc.buildDataset(2026, 5);
    expect(ds.counts).toMatchObject({ customers: 1, suppliers: 1, glEntries: 3, salesInvoices: 1, purchaseDocuments: 1, payments: 1 });
  });

  it('reads every section scoped to the active company (tenant/company isolation)', async () => {
    const { svc, repo } = make();
    await svc.buildDataset(2026, 5);
    expect(repo.glEntries).toHaveBeenCalledWith(expect.anything(), 'c1', '2026-05-01', '2026-05-31');
    expect(repo.customers).toHaveBeenCalledWith(expect.anything(), 'c1');
  });

  it('rejects an invalid month', async () => {
    await expect(make().svc.buildDataset(2026, 13)).rejects.toThrow();
  });
});
