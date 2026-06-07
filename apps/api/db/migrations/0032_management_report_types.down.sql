-- =====================================================================
-- 0032 DOWN — restore the original report_type CHECK (drops the management types).
-- Any rows with the new types must be removed first (none expected in normal use).
-- =====================================================================
DELETE FROM report_runs WHERE report_type IN ('revenue_by_month','expenses_by_month','cash_flow');

DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid = 'report_runs'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%report_type%';
  IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE report_runs DROP CONSTRAINT %I', cname); END IF;
END $$;

ALTER TABLE report_runs
  ADD CONSTRAINT report_runs_report_type_check CHECK (report_type IN (
    'trial_balance','general_ledger','account_card','journal','profit_and_loss',
    'balance_sheet','vat','invoice'));
