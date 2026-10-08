ALTER TABLE accounting_suggestions
  DROP COLUMN IF EXISTS classification_source,
  DROP COLUMN IF EXISTS classification_reason,
  DROP COLUMN IF EXISTS classification_confidence,
  DROP COLUMN IF EXISTS expense_category_id;
DROP POLICY IF EXISTS expense_categories_isolation ON expense_categories;
DROP TABLE IF EXISTS expense_categories;
