-- =====================================================================
-- 0033 DOWN — drop the banking tables (transactions → statements → accounts).
-- Payments created during reconciliation remain (immutable ledger effect).
-- =====================================================================
DROP TABLE IF EXISTS bank_transactions;
DROP TABLE IF EXISTS bank_statements;
DROP TABLE IF EXISTS bank_accounts;
