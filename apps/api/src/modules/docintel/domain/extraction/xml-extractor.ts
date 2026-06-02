import type { ExtractedField, FieldKey } from './models';

function tag(xml: string, name: string): string | undefined {
  const m = xml.match(new RegExp('<(?:\\w+:)?' + name + '[^>]*>([^<]+)<', 'i'));
  return m ? m[1].trim() : undefined;
}
/** Deterministic structured extraction from e-invoice XML (UBL-ish). High confidence (0.99). */
export function extractFromXml(xml: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  const push = (key: FieldKey, v?: string): void => {
    if (v !== undefined) f.push({ key, valueText: v, confidence: 0.99, source: 'xml', validationStatus: 'unchecked' });
  };
  push('invoice_number', tag(xml, 'ID') ?? tag(xml, 'InvoiceNumber'));
  push('invoice_date', tag(xml, 'IssueDate'));
  push('due_date', tag(xml, 'DueDate'));
  push('currency', tag(xml, 'DocumentCurrencyCode') ?? tag(xml, 'Currency'));
  push('supplier_name', tag(xml, 'RegistrationName') ?? tag(xml, 'SupplierName'));
  push('supplier_vat', tag(xml, 'CompanyID') ?? tag(xml, 'VAT'));
  push('total_amount', tag(xml, 'PayableAmount') ?? tag(xml, 'TotalAmount'));
  push('vat_amount', tag(xml, 'TaxAmount'));
  push('net_amount', tag(xml, 'TaxExclusiveAmount') ?? tag(xml, 'LineExtensionAmount'));
  push('iban', tag(xml, 'PaymentID') ?? tag(xml, 'IBAN'));
  return f;
}
