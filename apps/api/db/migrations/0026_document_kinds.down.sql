ALTER TABLE invoice_numbering_series DROP CONSTRAINT IF EXISTS uq_numbering_per_kind;
ALTER TABLE invoice_numbering_series
  ADD CONSTRAINT invoice_numbering_series_kind_revert_key UNIQUE (tenant_id, company_id, series_code, series_year);
ALTER TABLE invoice_numbering_series DROP COLUMN IF EXISTS document_kind;

DROP INDEX IF EXISTS idx_invoices_kind;
DROP INDEX IF EXISTS idx_invoices_reference;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_reference_fk;
ALTER TABLE invoices
  DROP COLUMN IF EXISTS references_invoice_id,
  DROP COLUMN IF EXISTS document_kind;
