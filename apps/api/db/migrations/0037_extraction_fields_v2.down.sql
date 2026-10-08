-- Down (dev-only): revert the field_key CHECK to the 0017 set and drop diagnostics.
-- Will fail if any extraction_fields row uses a 0037 key — delete those first in dev.
ALTER TABLE extraction_runs DROP COLUMN IF EXISTS diagnostics;

ALTER TABLE extraction_fields DROP CONSTRAINT IF EXISTS extraction_fields_field_key_check;
ALTER TABLE extraction_fields
  ADD CONSTRAINT extraction_fields_field_key_check CHECK (field_key IN (
    'supplier_name','supplier_vat','supplier_eik','supplier_city',
    'customer_name','customer_eik','customer_vat',
    'invoice_number','invoice_date','due_date','currency',
    'net_amount','vat_amount','total_amount','vat_rate',
    'iban','bank_name','bank_bic','payment_method','payment_reference'));
