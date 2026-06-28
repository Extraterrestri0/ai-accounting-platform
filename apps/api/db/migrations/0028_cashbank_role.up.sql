-- =====================================================================
-- 0028 Cash/Bank account role (Task 3.1 — Receivables & Payables Engine)
-- Adds a `cash_bank` posting role (canonical default 503 "Разплащателна сметка")
-- so payment settlement entries resolve a real account through the existing
-- account-mapping infrastructure (0023) instead of a hardcoded number:
--   * customer payment  Dr cash_bank(503) / Cr receivable(411)
--   * supplier payment  Dr payable(401)    / Cr cash_bank(503)
-- Additive + backward-compatible: extends the role CHECK, ensures every company
-- that already has a chart owns a 503 account, and seeds the cash_bank mapping.
-- Builds on 0001-0027.
-- =====================================================================

-- ---- 1) widen the account_mappings.role CHECK to include cash_bank ----------
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
    'purchase_expense_default','purchase_vat_input','payable',
    'cash_bank'));

-- ---- 2) ensure a postable 503 account exists for every company with a chart --
-- (a chart is "present" when the canonical receivable 411 already exists.)
INSERT INTO accounts (tenant_id, company_id, code, name, type, normal_balance, status, is_postable)
SELECT r.tenant_id, r.company_id, '503', 'Разплащателна сметка', 'asset', 'debit', 'active', true
FROM accounts r
WHERE r.code = '411'
  AND NOT EXISTS (
    SELECT 1 FROM accounts c
     WHERE c.tenant_id = r.tenant_id AND c.company_id = r.company_id AND c.code = '503')
ON CONFLICT (tenant_id, company_id, code) DO NOTHING;

-- ---- 3) seed the cash_bank → 503 mapping (idempotent; runs as migration owner) --
INSERT INTO account_mappings (tenant_id, company_id, role, account_id)
SELECT a.tenant_id, a.company_id, 'cash_bank', a.id
FROM accounts a
WHERE a.code = '503'
ON CONFLICT (tenant_id, company_id, role) DO NOTHING;
