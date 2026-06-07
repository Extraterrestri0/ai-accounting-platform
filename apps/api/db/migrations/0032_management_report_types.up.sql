-- =====================================================================
-- 0032 Management report types (Revenue/Expenses by Month, Cash Flow)
-- Additive: widen the report_runs.report_type CHECK so the new ledger-derived
-- management reports can be recorded as runs (same as every existing report).
-- No data change; existing rows are unaffected. Builds on 0001-0031.
-- =====================================================================

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
    'balance_sheet','vat','invoice',
    'revenue_by_month','expenses_by_month','cash_flow'));
