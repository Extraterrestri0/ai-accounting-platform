-- =====================================================================
-- 0028 DOWN — remove the cash_bank role mapping + restore the original CHECK.
-- The 503 accounts are LEFT in place (they may already carry payment postings,
-- and accounts are mutable master data — dropping them is unsafe).
-- =====================================================================

DELETE FROM account_mappings WHERE role = 'cash_bank';

DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid = 'account_mappings'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%role%';
  IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE account_mappings DROP CONSTRAINT %I', cname); END IF;
END $$;
ALTER TABLE account_mappings
  ADD CONSTRAINT account_mappings_role_check CHECK (role IN (
    'sales_revenue','sales_vat_output','receivable',
    'purchase_expense_default','purchase_vat_input','payable'));
