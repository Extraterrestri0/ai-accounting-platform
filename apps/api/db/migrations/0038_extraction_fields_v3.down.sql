-- Down (dev-only): revert the field_key CHECK to the 0037 set.
-- Fails if any row uses a 0038 key — delete those first in dev.
ALTER TABLE extraction_fields DROP CONSTRAINT IF EXISTS extraction_fields_field_key_check;
ALTER TABLE extraction_fields
  ADD CONSTRAINT extraction_fields_field_key_check CHECK (field_key IN (
    'supplier_name','supplier_vat','supplier_eik','supplier_city',
    'customer_name','customer_eik','customer_vat',
    'invoice_number','invoice_date','due_date','currency',
    'net_amount','vat_amount','total_amount','vat_rate',
    'iban','bank_name','bank_bic','payment_method','payment_reference',
    'supplier_address','supplier_country',
    'document_number','document_type','vat_code',
    'description','notes','line_items'));
