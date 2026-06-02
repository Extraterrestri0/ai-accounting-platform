'use client';
/**
 * Preview mock-data layer. The static preview ships UI only — this shim intercepts window.fetch
 * for '/api/...' calls and returns canned data so every representative screen renders without a backend.
 * In a real deployment this is removed and the screens call the NestJS API.
 */
let installed = false;
const J = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });

const handlers: { test: RegExp; data: unknown }[] = [
  { test: /\/documents$/, data: [
    { id: 'doc-1', originalFilename: 'invoice-2026-04.pdf', status: 'ready', createdAt: '2026-04-15' },
    { id: 'doc-2', originalFilename: 'receipt-scan.png', status: 'scanning', createdAt: '2026-04-16' },
  ] },
  { test: /\/review-package$/, data: { documentId: 'doc-1', docType: 'invoice', overallConfidence: 0.87, fields: [
    { key: 'invoice_number', valueText: 'INV-2026-001', confidence: 0.99, source: 'ocr', validationStatus: 'valid' },
    { key: 'total_amount', valueText: '240.00', confidence: 0.94, source: 'ocr', validationStatus: 'valid' },
    { key: 'vat_amount', valueText: '40.00', confidence: 0.92, source: 'ocr', validationStatus: 'valid' },
    { key: 'supplier_eik', valueText: '111111113', confidence: 0.95, source: 'ocr', validationStatus: 'valid' },
    { key: 'supplier_name', valueText: 'Acme OOD', confidence: 0.84, source: 'ocr', validationStatus: 'warning' },
  ], flags: { lowConfidenceFields: ['supplier_name'], failedValidations: [], missingRequired: [] } } },
  { test: /\/suggestion$/, data: { suggestedAccountCode: '602', confidence: 0.91, explanation: 'Previous 18 invoices from this supplier posted to account 602. Supplier matched by EIK.', isDuplicate: false, suggestedPosting: [
    { accountCode: '602', side: 'debit', amount: '200.00' }, { accountCode: '4531', side: 'debit', amount: '40.00' }, { accountCode: '401', side: 'credit', amount: '240.00' }], vat: { treatment: 'standard', rate: 20, confidence: 0.9, explanation: 'BG standard 20%' } } },
  { test: /\/reviews\/queue/, data: { items: [
    { id: 'rp-1', documentId: 'doc-1', filename: 'invoice-2026-04.pdf', status: 'pending', confidence: 0.91, isDuplicate: false, createdAt: '2026-04-15' },
    { id: 'rp-2', documentId: 'doc-3', filename: 'receipt-scan.png', status: 'pending', confidence: 0.72, isDuplicate: false, createdAt: '2026-04-16' },
  ], total: 2, page: 1, pageSize: 25 } },
  { test: /\/reviews\/dashboard/, data: { pending: 7, needsCorrection: 2, approved: 41, rejected: 3, assignedToMe: 3 } },
  { test: /\/reviews\/documents\//, data: { package: { id: 'rp-1', status: 'pending' }, documentDownloadUrl: '', extraction: { overallConfidence: 0.87, fields: [
    { key: 'invoice_number', valueText: 'INV-2026-001', confidence: 0.99, validationStatus: 'valid' },
    { key: 'total_amount', valueText: '240.00', confidence: 0.94, validationStatus: 'valid' } ] }, suggestion: { suggestedAccountCode: '602', confidence: 0.91, explanation: 'Previous 18 invoices…', isDuplicate: false, vat: { treatment: 'standard', rate: 20 } }, comments: [] } },
  { test: /\/posting$/, data: { request: { id: 'pr-1', status: 'posted', kind: 'post', lines: [
    { accountCode: '602', side: 'debit', amount: '200.00' }, { accountCode: '4531', side: 'debit', amount: '40.00' }, { accountCode: '401', side: 'credit', amount: '240.00' } ] }, journalEntryId: 'je-1042' } },
  { test: /\/vat\/\d+\/\d+\/summary/, data: { outputVat: 60, deductibleVat: 40, vatPayable: 20, vatRefundable: 0 } },
  { test: /\/vat\/\d+\/\d+\/purchase-register/, data: [{ documentRef: 'INV-IN-1', treatment: 'standard', base: 200, vat: 40, deductible: 40 }] },
  { test: /\/vat\/\d+\/\d+\/sales-register/, data: [{ documentRef: 'INV-OUT-1', treatment: 'standard', base: 300, vat: 60, deductible: 0 }] },
  { test: /\/vat\/\d+\/\d+\/return/, data: { summary: { outputVat: 60, deductibleVat: 40, vatPayable: 20, vatRefundable: 0 }, dataset: { cell11_taxableBaseSales: '300.00', cell50_outputVat: '60.00', cell40_vatPayable: '20.00' } } },
  { test: /\/invoices\/[\w-]+\/email$/, data: [{ id: 'e1', toEmail: 'beta@example.com', status: 'sent' }] },
  { test: /\/invoices\/[\w-]+$/, data: { id: 'inv-1', status: 'issued', invoiceNumber: '2026-0001', customerName: 'Beta EOOD', netTotal: '300.00', vatTotal: '60.00', grossTotal: '360.00', currency: 'EUR', journalEntryId: 'je-1042', lines: [
    { description: 'Consulting services', quantity: '1', unitPrice: '300.00', vatRate: '20', netAmount: '300.00', vatAmount: '60.00', grossAmount: '360.00' } ] } },
  { test: /\/invoices$/, data: [
    { id: 'inv-1', status: 'issued', invoiceNumber: '2026-0001', customerName: 'Beta EOOD', grossTotal: '360.00', currency: 'EUR', issueDate: '2026-06-02' },
    { id: 'inv-2', status: 'draft', customerName: 'Gamma AD', grossTotal: '120.00', currency: 'EUR' },
  ] },
  { test: /\/reports\/trial-balance/, data: { rows: [
    { accountCode: '401', accountName: 'Suppliers', debit: '0.00', credit: '100.00', balance: '-100.00' },
    { accountCode: '411', accountName: 'Customers', debit: '300.00', credit: '0.00', balance: '300.00' },
    { accountCode: '602', accountName: 'External Services', debit: '100.00', credit: '0.00', balance: '100.00' },
    { accountCode: '702', accountName: 'Revenue', debit: '0.00', credit: '300.00', balance: '-300.00' },
  ], totals: { debit: '400.00', credit: '400.00', balanced: true }, period: { from: '2026-04-01', to: '2026-04-30' } } },
  { test: /\/reports\/general-ledger/, data: [
    { accountCode: '411', accountName: 'Customers', lines: [{ date: '2026-04-10', ref: 'JE1', direction: 'debit', amount: '300.00', balance: '300.00' }], total: { debit: '300.00', credit: '0.00' } },
  ] },
  { test: /\/reports\/profit-and-loss/, data: { revenue: '300.00', expense: '100.00', netProfit: '200.00', period: { from: '2026-04-01', to: '2026-04-30' } } },
  { test: /\/reports\/vat/, data: { outputVat: 60, deductibleVat: 40, vatPayable: 20, vatRefundable: 0 } },
];

export function installMockApi(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/')) {
      const path = url.split('?')[0];
      const h = handlers.find((x) => x.test.test(path));
      return J(h ? h.data : (path.endsWith('s') ? [] : {}));
    }
    return original(input as RequestInfo, init);
  };
}
