-- =====================================================================
-- 0036 DOWN — revert the SAF-T data-quality scaffolding (dev rollback).
-- =====================================================================
DROP TABLE IF EXISTS saft_standard_accounts;
ALTER TABLE catalog_items DROP COLUMN IF EXISTS uom_code;
ALTER TABLE invoice_lines DROP COLUMN IF EXISTS uom_code;
ALTER TABLE payments      DROP COLUMN IF EXISTS payment_method;
