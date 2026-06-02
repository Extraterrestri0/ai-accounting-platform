DROP POLICY IF EXISTS vat_suggestions_isolation ON vat_suggestions;
DROP POLICY IF EXISTS accounting_suggestions_isolation ON accounting_suggestions;
DROP POLICY IF EXISTS rule_versions_isolation ON rule_versions;
DROP POLICY IF EXISTS rules_isolation ON rules;
DROP TRIGGER IF EXISTS rule_versions_immutable ON rule_versions;
DROP TABLE IF EXISTS vat_suggestions;
DROP TABLE IF EXISTS accounting_suggestions;
DROP TABLE IF EXISTS rule_versions;
DROP TABLE IF EXISTS rules;
