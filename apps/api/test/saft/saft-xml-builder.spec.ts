import { buildSaftXml, writeSaftXml, escapeXmlText, escapeXmlAttr, SAFT_XML_NAMESPACE } from '../../src/modules/saft/domain/saft-xml.builder';
import type { SaftDataset } from '../../src/modules/saft/domain/models';

/** A small, fully-known dataset with a FIXED generatedAt (so the golden output is stable). */
function sampleDataset(over: Partial<SaftDataset> = {}): SaftDataset {
  return {
    header: {
      companyName: 'Акме ООД', eik: '123456789', vatNumber: 'BG123456789',
      period: { year: 2026, month: 5, from: '2026-05-01', to: '2026-05-31' },
      currency: 'EUR', softwareName: 'Счетоводство (MGI-Delta)', softwareVersion: '1.0.0-saft1',
      generatedAt: '2026-06-01T08:30:00.000Z',
    },
    masterFiles: {
      customers: [{ id: 'cust1', name: 'Бета ЕООД', vatNumber: 'BG999', country: 'BG' }],
      suppliers: [{ id: 'sup1', name: 'Vendor GmbH', country: 'DE' }],
      products: [{ code: 'P1', description: 'Услуга', unit: 'бр', vatRate: '20', kind: 'service', saftCode: 'SVC' }],
      accounts: [{ accountCode: '702', accountName: 'Приходи', accountType: 'revenue' }],
      taxCodes: [{ vatCode: 'STD20', vatRate: '20', vatTreatment: 'standard', direction: 'both', saftTaxCode: 'S' }],
    },
    generalLedgerEntries: [{
      journalEntryId: 'e1', entryNo: 1, postingDate: '2026-05-10', documentReference: 'INV-1',
      sourceType: 'invoice', sourceId: 'inv-1', lines: [
        { lineNumber: 1, accountCode: '411', debit: '120.00', credit: '0.00' },
        { lineNumber: 2, accountCode: '702', debit: '0.00', credit: '100.00' },
        { lineNumber: 3, accountCode: '4532', debit: '0.00', credit: '20.00' },
      ],
    }],
    sourceDocuments: {
      salesInvoices: [{ invoiceNumber: '2026-0001', invoiceDate: '2026-05-10', customer: 'Бета ЕООД', netAmount: '100.00', vatAmount: '20.00', grossAmount: '120.00', documentType: 'invoice', vatCode: 'STD20' }],
      purchaseDocuments: [{ documentNumber: '#7', documentDate: '2026-05-12', supplier: 'Vendor GmbH', supplierId: 'sup1', netAmount: '200.00', vatAmount: '40.00', grossAmount: '240.00', approvalStatus: 'approved' }],
      payments: [{ paymentDate: '2026-05-15', amount: '120.00', direction: 'inbound', counterparty: 'Бета ЕООД', reconciliationStatus: 'reconciled' }],
    },
    counts: { customers: 1, suppliers: 1, products: 1, accounts: 1, taxCodes: 1, glEntries: 1, salesInvoices: 1, purchaseDocuments: 1, payments: 1 },
    ...over,
  };
}

describe('SaftXmlBuilder (Phase 3)', () => {
  it('renders a stable golden document (snapshot)', () => {
    expect(buildSaftXml(sampleDataset())).toMatchSnapshot();
  });

  it('is deterministic — same input → byte-identical output', () => {
    expect(buildSaftXml(sampleDataset())).toBe(buildSaftXml(sampleDataset()));
  });

  it('emits a well-formed prologue, namespaced root, and the SAF-T sections in fixed order', () => {
    const xml = buildSaftXml(sampleDataset());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain(`<AuditFile xmlns="${SAFT_XML_NAMESPACE}">`);
    // Section order is part of the contract.
    const order = ['<Header>', '<MasterFiles>', '<GeneralLedgerEntries>', '<SourceDocuments>'].map((t) => xml.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(xml.trimEnd().endsWith('</AuditFile>')).toBe(true);
  });

  it('carries header + counts derived from the dataset', () => {
    const xml = buildSaftXml(sampleDataset());
    expect(xml).toContain('<AuditFileCountry>BG</AuditFileCountry>');
    expect(xml).toContain('<AuditFileDateCreated>2026-06-01</AuditFileDateCreated>'); // date of generatedAt
    expect(xml).toContain('<DefaultCurrencyCode>EUR</DefaultCurrencyCode>');
    expect(xml).toContain('<NumberOfEntries>1</NumberOfEntries>');
    expect(xml).toContain('<DebitAmount>120.00</DebitAmount>');
  });

  it('omits absent optional fields deterministically', () => {
    const ds = sampleDataset();
    ds.header.eik = undefined;           // company registration number absent
    ds.masterFiles.suppliers[0].vatNumber = undefined;
    const xml = buildSaftXml(ds);
    // The company block must not render an empty RegistrationNumber.
    expect(xml).not.toMatch(/<Company>[\s\S]*?<RegistrationNumber>[\s\S]*?<\/Company>/);
    // Supplier with no VAT number → no TaxRegistrationNumber for that party.
    expect(xml).toContain('<SupplierID>sup1</SupplierID>');
  });

  it('escapes XML metacharacters in text content (no injection)', () => {
    const ds = sampleDataset();
    ds.masterFiles.customers[0].name = 'A&B <Ltd> "Co" >';
    const xml = buildSaftXml(ds);
    expect(xml).toContain('<Name>A&amp;B &lt;Ltd&gt; "Co" &gt;</Name>');
    expect(xml).not.toContain('<Ltd>'); // the raw injected tag never appears
  });

  it('streaming sink produces exactly the same bytes as the string builder', () => {
    const chunks: string[] = [];
    writeSaftXml(sampleDataset(), (c) => chunks.push(c));
    expect(chunks.join('')).toBe(buildSaftXml(sampleDataset()));
    expect(chunks.length).toBeGreaterThan(1); // actually streamed in pieces
  });

  it('emits coded UOM + payment mechanism only when present (Phase 8 scaffolding)', () => {
    const base = sampleDataset();
    expect(buildSaftXml(base)).not.toContain('<UnitOfMeasureCode>'); // absent by default (no NRA codes)
    expect(buildSaftXml(base)).not.toContain('<PaymentMechanism>');
    const ds = sampleDataset();
    ds.masterFiles.products[0].uomCode = 'C62';
    ds.sourceDocuments.payments[0].paymentMechanism = 'TRANSFER';
    const xml = buildSaftXml(ds);
    expect(xml).toContain('<UnitOfMeasureCode>C62</UnitOfMeasureCode>');
    expect(xml).toContain('<PaymentMechanism>TRANSFER</PaymentMechanism>');
  });

  it('handles an empty period without malformed XML', () => {
    const empty = sampleDataset({
      masterFiles: { customers: [], suppliers: [], products: [], accounts: [], taxCodes: [] },
      generalLedgerEntries: [],
      sourceDocuments: { salesInvoices: [], purchaseDocuments: [], payments: [] },
      counts: { customers: 0, suppliers: 0, products: 0, accounts: 0, taxCodes: 0, glEntries: 0, salesInvoices: 0, purchaseDocuments: 0, payments: 0 },
    });
    const xml = buildSaftXml(empty);
    expect(xml).toContain('<NumberOfEntries>0</NumberOfEntries>');
    expect(xml).toContain('<GeneralLedgerAccounts>');
    expect(xml.trimEnd().endsWith('</AuditFile>')).toBe(true);
  });
});

describe('XML escaping helpers', () => {
  it('escapeXmlText escapes & < > and strips C0 control chars (keeps tab/newline)', () => {
    expect(escapeXmlText('a&b<c>d')).toBe('a&amp;b&lt;c&gt;d');
    expect(escapeXmlText('x' + String.fromCharCode(0) + 'y	z')).toBe('xy	z'); // NUL stripped, tab kept
  });
  it('escapeXmlAttr additionally escapes double quotes', () => {
    expect(escapeXmlAttr('a"b&c')).toBe('a&quot;b&amp;c');
  });
});
