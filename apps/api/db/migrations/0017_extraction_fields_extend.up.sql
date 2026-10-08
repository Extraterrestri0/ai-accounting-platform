-- =====================================================================
-- 0017 Extend the extraction_fields.field_key CHECK with additional
-- Bulgarian invoice header fields (customer id, supplier city, bank/BIC,
-- payment method, VAT rate). Additive only — existing keys unchanged.
-- =====================================================================
ALTER TABLE extraction_fields DROP CONSTRAINT IF EXISTS extraction_fields_field_key_check;
ALTER TABLE extraction_fields
  ADD CONSTRAINT extraction_fields_field_key_check CHECK (field_key IN (
    'supplier_name','supplier_vat','supplier_eik','supplier_city',
    'customer_name','customer_eik','customer_vat',
    'invoice_number','invoice_date','due_date','currency',
    'net_amount','vat_amount','total_amount','vat_rate',
    'iban','bank_name','bank_bic','payment_method','payment_reference'));
