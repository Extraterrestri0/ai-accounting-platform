DROP POLICY IF EXISTS vat_returns_isolation ON vat_returns;
DROP POLICY IF EXISTS vat_register_entries_isolation ON vat_register_entries;
DROP POLICY IF EXISTS vat_periods_isolation ON vat_periods;
DROP TRIGGER IF EXISTS vat_register_immutable ON vat_register_entries;
DROP TABLE IF EXISTS vat_returns;
DROP TABLE IF EXISTS vat_register_entries;
DROP TABLE IF EXISTS vat_periods;
