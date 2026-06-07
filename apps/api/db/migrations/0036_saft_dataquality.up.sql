-- =====================================================================
-- 0036 SAF-T data-quality scaffolding (Phase 8). ADDITIVE / expand-only.
-- Provides the DATA-DRIVEN structures for regulator-required code sets WITHOUT
-- inventing any НАП values — every column/table below ships EMPTY and is populated
-- once the official НАП SAF-T schema/spec is available. Builds on 0035.
-- =====================================================================

-- #1 SAF-T standard-account mapping (company chart-of-accounts code → НАП standard account).
-- Configuration data (admin-managed), company-scoped + RLS. NO rows seeded.
CREATE TABLE saft_standard_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  account_code          text NOT NULL,            -- references the company's accounts.code
  standard_account_code text NOT NULL,            -- the official НАП standard account id (value supplied later)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, account_code),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_saft_std_accounts ON saft_standard_accounts (tenant_id, company_id, account_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON saft_standard_accounts TO app_user;  -- editable config

ALTER TABLE saft_standard_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saft_standard_accounts FORCE  ROW LEVEL SECURITY;
CREATE POLICY saft_standard_accounts_isolation ON saft_standard_accounts
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());

-- #5 UOM code (coded unit of measure for SAF-T). Free-text `unit` stays; this is the coded value.
ALTER TABLE catalog_items   ADD COLUMN IF NOT EXISTS uom_code text;     -- value supplied later (e.g. UN/ECE Rec 20 subset)
ALTER TABLE invoice_lines   ADD COLUMN IF NOT EXISTS uom_code text;     -- per-line snapshot

-- #6 Payment mechanism code (SAF-T PaymentMechanism). Captured/derived later; NO enum hardcoded.
ALTER TABLE payments        ADD COLUMN IF NOT EXISTS payment_method text;
