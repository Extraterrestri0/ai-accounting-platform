-- =====================================================================
-- 0026 Document kinds: Credit Notes, Debit Notes, Proforma (Task 2.2)
-- Adds document_kind + references_invoice_id to invoices, and makes the gapless
-- numbering series per document kind. Additive: existing rows default to 'invoice'
-- so the current invoice flow is unchanged. Builds on 0001-0025.
-- =====================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'invoice'
    CHECK (document_kind IN ('invoice','credit_note','debit_note','proforma')),
  ADD COLUMN IF NOT EXISTS references_invoice_id uuid;   -- source doc for a credit/debit note / proforma→invoice
ALTER TABLE invoices
  ADD CONSTRAINT invoices_reference_fk
  FOREIGN KEY (tenant_id, references_invoice_id) REFERENCES invoices(tenant_id, id);
CREATE INDEX idx_invoices_reference ON invoices (tenant_id, references_invoice_id);
CREATE INDEX idx_invoices_kind      ON invoices (tenant_id, company_id, document_kind, created_at DESC);

-- ---- numbering series become per document kind -------------------------------
ALTER TABLE invoice_numbering_series
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'invoice'
    CHECK (document_kind IN ('invoice','credit_note','debit_note','proforma'));
-- replace the old (company, series, year) uniqueness with one that includes the kind
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid = 'invoice_numbering_series'::regclass AND contype = 'u'
     AND pg_get_constraintdef(oid) LIKE 'UNIQUE (tenant_id, company_id, series_code, series_year)%';
  IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE invoice_numbering_series DROP CONSTRAINT %I', cname); END IF;
END $$;
ALTER TABLE invoice_numbering_series
  ADD CONSTRAINT uq_numbering_per_kind UNIQUE (tenant_id, company_id, document_kind, series_code, series_year);
