-- =====================================================================
-- 0030 DOWN — drop the accounting_periods table. Removing it makes every period
-- read as OPEN again (the application defaults to open when no row exists).
-- =====================================================================
DROP TABLE IF EXISTS accounting_periods;
