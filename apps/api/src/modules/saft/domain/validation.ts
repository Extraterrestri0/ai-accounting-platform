import { entryBalanced } from './assemble';
import type { SaftDataset, ValidationIssue, ValidationSummary } from './models';

/**
 * PURE SAF-T dataset validation. Produces aggregated errors/warnings/info. Warnings
 * and info NEVER block generation; only ERRORS set ok=false (callers still persist
 * the export — the summary documents data gaps to fix before final XML submission).
 */
export function validateDataset(ds: SaftDataset): ValidationSummary {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // ---- company ----
  if (!ds.header.vatNumber) warnings.push({ level: 'warning', code: 'company_vat_missing', message: 'Фирмата няма ДДС номер в заглавния блок.' });

  // ---- master data VAT numbers ----
  const custNoVat = ds.masterFiles.customers.filter((c) => !c.vatNumber).length;
  if (custNoVat > 0) warnings.push({ level: 'warning', code: 'customer_vat_missing', message: 'Клиенти без ДДС номер.', count: custNoVat });
  const supNoVat = ds.masterFiles.suppliers.filter((s) => !s.vatNumber).length;
  if (supNoVat > 0) warnings.push({ level: 'warning', code: 'supplier_vat_missing', message: 'Доставчици без ДДС номер.', count: supNoVat });

  // ---- SAF-T codes (informational) ----
  const noSaft =
    ds.masterFiles.accounts.filter((a) => !a.saftCode).length +
    ds.masterFiles.products.filter((p) => !p.saftCode).length +
    ds.masterFiles.taxCodes.filter((t) => !t.saftTaxCode).length +
    ds.masterFiles.customers.filter((c) => !c.saftCode).length +
    ds.masterFiles.suppliers.filter((s) => !s.saftCode).length;
  if (noSaft > 0) info.push({ level: 'info', code: 'saft_codes_missing', message: 'Записи без SAF-T код (по избор за v1).', count: noSaft });

  // ---- VAT codes ----
  if (ds.masterFiles.taxCodes.length === 0) warnings.push({ level: 'warning', code: 'tax_codes_missing', message: 'Няма дефинирани ДДС кодове.' });
  const invNoVatCode = ds.sourceDocuments.salesInvoices.filter((i) => !i.vatCode).length;
  if (invNoVatCode > 0) info.push({ level: 'info', code: 'invoice_vat_code_missing', message: 'Фактури без приложен ДДС код.', count: invNoVatCode });

  // ---- document references on GL ----
  const glNoRef = ds.generalLedgerEntries.filter((e) => !e.documentReference).length;
  if (glNoRef > 0) warnings.push({ level: 'warning', code: 'gl_doc_ref_missing', message: 'Счетоводни статии без документна референция.', count: glNoRef });

  // ---- unbalanced ledger entries (ERROR) ----
  const unbalanced = ds.generalLedgerEntries.filter((e) => !entryBalanced(e.lines)).length;
  if (unbalanced > 0) errors.push({ level: 'error', code: 'gl_unbalanced', message: 'Небалансирани счетоводни статии (дебит ≠ кредит).', count: unbalanced });

  // ---- purchase approval status ----
  const purchNoStatus = ds.sourceDocuments.purchaseDocuments.filter((p) => !p.approvalStatus).length;
  if (purchNoStatus > 0) info.push({ level: 'info', code: 'purchase_approval_missing', message: 'Покупки без статус на одобрение.', count: purchNoStatus });

  // ---- source documents present? ----
  const srcCount = ds.sourceDocuments.salesInvoices.length + ds.sourceDocuments.purchaseDocuments.length + ds.sourceDocuments.payments.length;
  if (ds.generalLedgerEntries.length > 0 && srcCount === 0) warnings.push({ level: 'warning', code: 'no_source_documents', message: 'Има счетоводни статии, но липсват изходни документи за периода.' });
  if (ds.generalLedgerEntries.length === 0 && srcCount === 0) info.push({ level: 'info', code: 'empty_period', message: 'Няма данни за избрания период.' });

  return {
    ok: errors.length === 0,
    errors, warnings, info,
    counts: { errors: errors.length, warnings: warnings.length, info: info.length },
  };
}
