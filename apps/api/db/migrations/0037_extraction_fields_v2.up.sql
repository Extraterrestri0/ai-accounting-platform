-- =====================================================================
-- 0037 Invoice extraction reliability — additional canonical fields + run diagnostics.
--
-- (1) Extend extraction_fields.field_key CHECK with the accounting-relevant header
--     fields the pipeline can now capture (address, country, document number/type,
--     VAT code, description, notes, line-items summary). Additive only — every
--     existing key is preserved, so prior extractions and the current flow are
--     unaffected (expand-only; no data rewrite).
-- (2) Add extraction_runs.diagnostics (jsonb) so every run records WHY a field was
--     found / derived / rejected (provider, layers run, rejected candidates +
--     reason, per-field provenance). Nullable → backward compatible. This makes a
--     missing extraction explainable in the review screen and the logs.
-- =====================================================================

ALTER TABLE extraction_fields DROP CONSTRAINT IF EXISTS extraction_fields_field_key_check;
ALTER TABLE extraction_fields
  ADD CONSTRAINT extraction_fields_field_key_check CHECK (field_key IN (
    -- existing (0009 + 0017)
    'supplier_name','supplier_vat','supplier_eik','supplier_city',
    'customer_name','customer_eik','customer_vat',
    'invoice_number','invoice_date','due_date','currency',
    'net_amount','vat_amount','total_amount','vat_rate',
    'iban','bank_name','bank_bic','payment_method','payment_reference',
    -- new (0037)
    'supplier_address','supplier_country',
    'document_number','document_type','vat_code',
    'description','notes','line_items'));

ALTER TABLE extraction_runs
  ADD COLUMN IF NOT EXISTS diagnostics jsonb;
