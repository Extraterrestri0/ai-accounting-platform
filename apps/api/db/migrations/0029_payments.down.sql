-- =====================================================================
-- 0029 DOWN — drop the payments table.
-- NOTE: settlement journal entries already written to the immutable ledger are
-- NOT removed (the ledger is append-only); only the payments workflow table is
-- dropped. Reverse the related ledger entries separately if a full rollback of
-- the accounting effect is required.
-- =====================================================================
DROP TABLE IF EXISTS payments;
