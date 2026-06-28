ALTER TABLE extraction_fields DROP CONSTRAINT IF EXISTS extraction_fields_field_key_check;
ALTER TABLE extraction_fields
  ADD CONSTRAINT extraction_fields_field_key_check CHECK (field_key IN (
    'supplier_name','supplier_vat','supplier_eik','customer_name',
    'invoice_number','invoice_date','due_date','currency',
    'net_amount','vat_amount','total_amount','iban','payment_reference'));
