ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_catalog_fk;
ALTER TABLE invoice_lines
  DROP COLUMN IF EXISTS saft_code,
  DROP COLUMN IF EXISTS unit,
  DROP COLUMN IF EXISTS catalog_item_id;
DROP POLICY IF EXISTS catalog_items_isolation ON catalog_items;
DROP TABLE IF EXISTS catalog_items;
