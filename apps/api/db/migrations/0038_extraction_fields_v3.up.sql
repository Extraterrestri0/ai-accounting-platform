-- =====================================================================
-- 0038 Upload extraction reliability — remaining accounting-relevant header fields.
-- Extends extraction_fields.field_key CHECK (additive only; every existing key kept):
--   customer_address / customer_country  — counterparty separation (never copied from supplier)
--   tax_event_date                       — "дата на данъчно събитие" when different from issue date
--   vat_treatment                        — standard / reduced / exempt / reverse_charge / intra_community
--   vat_exemption_reason                 — legal basis shown on the invoice (чл. … ЗДДС / Directive)
--   po_number / contract_number / delivery_note_number — order, contract, стокова разписка references
--   vehicle_reg_number                   — МПС рег. № (fuel/transport invoices)
-- Expand-only; no data rewrite; prior extractions unaffected.
-- =====================================================================

ALTER TABLE extraction_fields DROP CONSTRAINT IF EXISTS extraction_fields_field_key_check;
ALTER TABLE extraction_fields
  ADD CONSTRAINT extraction_fields_field_key_check CHECK (field_key IN (
    -- 0009 + 0017
    'supplier_name','supplier_vat','supplier_eik','supplier_city',
    'customer_name','customer_eik','customer_vat',
    'invoice_number','invoice_date','due_date','currency',
    'net_amount','vat_amount','total_amount','vat_rate',
    'iban','bank_name','bank_bic','payment_method','payment_reference',
    -- 0037
    'supplier_address','supplier_country',
    'document_number','document_type','vat_code',
    'description','notes','line_items',
    -- 0038
    'customer_address','customer_country',
    'tax_event_date','vat_treatment','vat_exemption_reason',
    'po_number','contract_number','delivery_note_number',
    'vehicle_reg_number'));
