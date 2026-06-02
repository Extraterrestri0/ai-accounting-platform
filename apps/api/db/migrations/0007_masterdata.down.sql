DROP POLICY IF EXISTS company_settings_isolation ON company_settings;
DROP POLICY IF EXISTS counterparties_isolation ON counterparties;
DROP POLICY IF EXISTS vat_codes_isolation ON vat_codes;
DROP TABLE IF EXISTS company_settings;
DROP TABLE IF EXISTS counterparties;
DROP TABLE IF EXISTS vat_codes;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_parent_fk;
ALTER TABLE accounts
  DROP COLUMN IF EXISTS is_postable,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS parent_account_id;
DROP TABLE IF EXISTS currencies;
DROP TABLE IF EXISTS countries;
