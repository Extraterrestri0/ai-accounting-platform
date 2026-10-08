-- =====================================================================
-- 0023 Configurable account mappings (Task 0.1)
-- Per-company role→account table that becomes the single source of truth
-- for automatic posting (invoice issue + purchase suggestion). Removes the
-- hardcoded 702/4532/411/602/4531/401 constants from application code.
--
-- Backward-compatible: application posting falls back to the canonical BG
-- chart codes when a role is unmapped, so companies without a row behave
-- exactly as before. Existing companies that already have the canonical
-- accounts are seeded below so the mapping is the source of truth from day one.
-- =====================================================================

CREATE TABLE account_mappings (
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  role       text NOT NULL CHECK (role IN (
               'sales_revenue','sales_vat_output','receivable',
               'purchase_expense_default','purchase_vat_input','payable')),
  account_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,                       -- acting user (no FK; mirrors audit actor_id)
  PRIMARY KEY (tenant_id, company_id, role),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  -- account must belong to the SAME tenant+company (composite FK into the chart of accounts)
  FOREIGN KEY (tenant_id, company_id, account_id) REFERENCES accounts(tenant_id, company_id, id)
);
CREATE INDEX idx_account_mappings_account ON account_mappings (tenant_id, company_id, account_id);

GRANT SELECT, INSERT, UPDATE ON account_mappings TO app_user;  -- upsert-only; no DELETE path

-- ---- RLS (company-scoped), same pattern as the other master-data tables ----
ALTER TABLE account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_mappings FORCE  ROW LEVEL SECURITY;
CREATE POLICY account_mappings_isolation ON account_mappings
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());

-- ---- Seed canonical defaults for every existing company that has the accounts ----
-- (idempotent; runs as the migration owner which is not RLS-restricted)
INSERT INTO account_mappings (tenant_id, company_id, role, account_id)
SELECT a.tenant_id, a.company_id, m.role, a.id
FROM accounts a
JOIN (VALUES
  ('702',  'sales_revenue'),
  ('4532', 'sales_vat_output'),
  ('411',  'receivable'),
  ('602',  'purchase_expense_default'),
  ('4531', 'purchase_vat_input'),
  ('401',  'payable')
) AS m(code, role) ON m.code = a.code
ON CONFLICT (tenant_id, company_id, role) DO NOTHING;
