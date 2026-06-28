/**
 * SAF-T XML builder (Phase 3). PURE + deterministic: maps a persisted SaftDataset to
 * "schema-shaped" SAF-T XML (OECD-SAF-T-like element names). It is NOT yet bound to the
 * official НАП XSD — that schema + namespace are dropped in later (Phase 4). No validation,
 * storage, or I/O here.
 *
 * Determinism guarantees (for stable golden fixtures):
 *  - elements are emitted in a fixed, hardcoded order;
 *  - collections iterate their dataset order (the repository already orders them);
 *  - optional fields are OMITTED when empty (same input → byte-identical output);
 *  - 2-space indentation, '\n' line endings, UTF-8.
 *
 * Memory-safety: output is produced through a streaming sink (writeSaftXml), so Phase 5 can
 * pipe straight to storage/HTTP without materializing the whole document; buildSaftXml is a
 * convenience wrapper that concatenates chunks.
 */
import type { SaftDataset, SaftParty } from './models';

/** Placeholder namespace; the official НАП SAF-T namespace is bound in Phase 4. */
export const SAFT_XML_NAMESPACE = 'urn:saft:bg:shaped:v2';

/**
 * Strip C0 control characters that XML 1.0 forbids, keeping the only legal ones
 * (tab 0x09, line-feed 0x0A, carriage-return 0x0D). Implemented as a char-code scan so
 * the source stays plain ASCII (no literal control bytes to corrupt in transit).
 */
function stripInvalid(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const invalid = code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f);
    if (!invalid) out += s[i];
  }
  return out;
}

/** Escape text content: &, <, > (and strip invalid control chars). */
export function escapeXmlText(s: string): string {
  return stripInvalid(s).replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
/** Escape attribute values: &, <, >, " (and strip invalid control chars). */
export function escapeXmlAttr(s: string): string {
  return stripInvalid(s).replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

type Sink = (chunk: string) => void;

/** Minimal, deterministic, indentation-aware streaming XML writer. */
class XmlWriter {
  private depth = 0;
  constructor(private readonly write: Sink) {}
  decl(): void { this.write('<?xml version="1.0" encoding="UTF-8"?>\n'); }
  private pad(): string { return '  '.repeat(this.depth); }
  open(name: string, attrs?: Array<[string, string]>): void {
    const a = attrs && attrs.length ? ' ' + attrs.map(([k, v]) => `${k}="${escapeXmlAttr(v)}"`).join(' ') : '';
    this.write(`${this.pad()}<${name}${a}>\n`);
    this.depth++;
  }
  close(name: string): void { this.depth--; this.write(`${this.pad()}</${name}>\n`); }
  /** Leaf element. Omitted entirely when the value is null/undefined/'' (deterministic optional handling). */
  leaf(name: string, value: string | number | null | undefined): void {
    if (value === null || value === undefined || value === '') return;
    this.write(`${this.pad()}<${name}>${escapeXmlText(String(value))}</${name}>\n`);
  }
}

function writeParty(w: XmlWriter, tag: 'Customer' | 'Supplier', p: SaftParty): void {
  w.open(tag);
  w.leaf(`${tag}ID`, p.id);
  w.leaf('Name', p.name);
  w.leaf('RegistrationNumber', p.eik);
  w.leaf('TaxRegistrationNumber', p.vatNumber);
  w.leaf('StandardCustomerSupplierID', p.saftCode);
  w.leaf('Address', p.address);
  w.leaf('City', p.city);
  w.leaf('Country', p.country);
  w.close(tag);
}

/** Stream the SAF-T XML for a dataset to a sink (memory-safe; no full-document buffer required). */
export function writeSaftXml(ds: SaftDataset, write: Sink): void {
  const w = new XmlWriter(write);
  const period = ds.header.period;
  w.decl();
  w.open('AuditFile', [['xmlns', SAFT_XML_NAMESPACE]]);

  // ---- Header ----
  w.open('Header');
  w.leaf('AuditFileVersion', ds.header.softwareVersion);
  w.leaf('AuditFileCountry', 'BG');
  w.leaf('AuditFileDateCreated', ds.header.generatedAt.slice(0, 10));
  w.leaf('SoftwareCompanyName', ds.header.softwareName);
  w.leaf('ProductID', `${ds.header.softwareName} ${ds.header.softwareVersion}`);
  w.open('Company');
  w.leaf('Name', ds.header.companyName);
  w.leaf('RegistrationNumber', ds.header.eik);
  w.leaf('TaxRegistrationNumber', ds.header.vatNumber);
  w.close('Company');
  w.leaf('DefaultCurrencyCode', ds.header.currency);
  w.open('SelectionCriteria');
  w.leaf('PeriodStart', period.from);
  w.leaf('PeriodEnd', period.to);
  w.leaf('Year', period.year);
  w.leaf('Month', period.month);
  w.close('SelectionCriteria');
  w.close('Header');

  // ---- MasterFiles ----
  w.open('MasterFiles');
  w.open('GeneralLedgerAccounts');
  for (const a of ds.masterFiles.accounts) {
    w.open('Account');
    w.leaf('AccountID', a.accountCode);
    w.leaf('AccountDescription', a.accountName);
    w.leaf('AccountType', a.accountType);
    w.leaf('StandardAccountID', a.saftCode);
    w.leaf('ParentAccountID', a.parentAccountCode);
    w.close('Account');
  }
  w.close('GeneralLedgerAccounts');
  w.open('Customers');
  for (const c of ds.masterFiles.customers) writeParty(w, 'Customer', c);
  w.close('Customers');
  w.open('Suppliers');
  for (const s of ds.masterFiles.suppliers) writeParty(w, 'Supplier', s);
  w.close('Suppliers');
  w.open('Products');
  for (const p of ds.masterFiles.products) {
    w.open('Product');
    w.leaf('ProductCode', p.code);
    w.leaf('Description', p.description);
    w.leaf('UnitOfMeasure', p.unit);
    w.leaf('UnitOfMeasureCode', p.uomCode); // coded UOM (omitted until mapped)
    w.leaf('TaxPercentage', p.vatRate);
    w.leaf('ProductType', p.kind);
    w.leaf('StandardProductID', p.saftCode);
    w.close('Product');
  }
  w.close('Products');
  w.open('TaxTable');
  for (const t of ds.masterFiles.taxCodes) {
    w.open('TaxTableEntry');
    w.leaf('TaxCode', t.vatCode);
    w.leaf('TaxPercentage', t.vatRate);
    w.leaf('TaxType', t.vatTreatment);
    w.leaf('TaxDirection', t.direction);
    w.leaf('StandardTaxCode', t.saftTaxCode);
    w.close('TaxTableEntry');
  }
  w.close('TaxTable');
  w.close('MasterFiles');

  // ---- GeneralLedgerEntries ----
  w.open('GeneralLedgerEntries');
  w.leaf('NumberOfEntries', ds.counts.glEntries);
  w.open('Journal');
  for (const e of ds.generalLedgerEntries) {
    w.open('Transaction');
    w.leaf('TransactionID', e.journalEntryId);
    w.leaf('TransactionNo', e.entryNo);
    w.leaf('Period', period.month);
    w.leaf('TransactionDate', e.postingDate);
    w.leaf('SourceType', e.sourceType);
    w.leaf('DocumentReference', e.documentReference);
    w.leaf('Description', e.description);
    w.open('Lines');
    for (const l of e.lines) {
      w.open('Line');
      w.leaf('RecordID', l.lineNumber);
      w.leaf('AccountID', l.accountCode);
      w.leaf('TaxCode', l.vatCode);
      w.leaf('DebitAmount', l.debit);
      w.leaf('CreditAmount', l.credit);
      w.leaf('Description', l.narrative);
      w.close('Line');
    }
    w.close('Lines');
    w.close('Transaction');
  }
  w.close('Journal');
  w.close('GeneralLedgerEntries');

  // ---- SourceDocuments ----
  w.open('SourceDocuments');
  w.open('SalesInvoices');
  for (const i of ds.sourceDocuments.salesInvoices) {
    w.open('Invoice');
    w.leaf('InvoiceNo', i.invoiceNumber);
    w.leaf('InvoiceDate', i.invoiceDate);
    w.leaf('CustomerName', i.customer);
    w.leaf('CustomerID', i.customerId);
    w.leaf('DocumentType', i.documentType);
    w.leaf('TaxCode', i.vatCode);
    w.leaf('NetTotal', i.netAmount);
    w.leaf('TaxPayable', i.vatAmount);
    w.leaf('GrossTotal', i.grossAmount);
    w.close('Invoice');
  }
  w.close('SalesInvoices');
  w.open('PurchaseInvoices');
  for (const p of ds.sourceDocuments.purchaseDocuments) {
    w.open('Invoice');
    w.leaf('DocumentNo', p.documentNumber);
    w.leaf('DocumentDate', p.documentDate);
    w.leaf('SupplierName', p.supplier);
    w.leaf('SupplierID', p.supplierId);
    w.leaf('NetTotal', p.netAmount);
    w.leaf('TaxPayable', p.vatAmount);
    w.leaf('GrossTotal', p.grossAmount);
    w.leaf('ClassificationCategory', p.classificationCategory);
    w.leaf('ApprovalStatus', p.approvalStatus);
    w.close('Invoice');
  }
  w.close('PurchaseInvoices');
  w.open('Payments');
  for (const pay of ds.sourceDocuments.payments) {
    w.open('Payment');
    w.leaf('PaymentDate', pay.paymentDate);
    w.leaf('Amount', pay.amount);
    w.leaf('Direction', pay.direction);
    w.leaf('PaymentMechanism', pay.paymentMechanism); // coded mechanism (omitted until captured)
    w.leaf('CounterpartyName', pay.counterparty);
    w.leaf('LinkedDocumentType', pay.linkedDocumentType);
    w.leaf('LinkedDocumentID', pay.linkedDocumentId);
    w.leaf('BankReference', pay.bankReference);
    w.leaf('ReconciliationStatus', pay.reconciliationStatus);
    w.close('Payment');
  }
  w.close('Payments');
  w.close('SourceDocuments');

  w.close('AuditFile');
}

/** Convenience wrapper: render the full document to a single string. */
export function buildSaftXml(ds: SaftDataset): string {
  const chunks: string[] = [];
  writeSaftXml(ds, (c) => chunks.push(c));
  return chunks.join('');
}
