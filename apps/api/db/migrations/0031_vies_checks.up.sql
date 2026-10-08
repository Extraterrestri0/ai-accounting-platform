-- =====================================================================
-- 0031 VIES Validation cache (Task 4.2)
-- vies_checks records each EU VAT-number validation (live or cached) so the app
-- can show a counterparty's VAT-valid status without re-hitting VIES every time.
-- A check is "fresh" while now() < expires_at. Append-mostly: a refresh inserts a
-- new row (full history); the latest fresh row per vat_number wins. Company-scoped
-- + RLS. Reads counterparties/invoices live (read-model) — no schema changes there.
-- Builds on 0001-0030.
-- =====================================================================

CREATE TABLE vies_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  company_id       uuid NOT NULL,
  counterparty_id  uuid,                          -- nullable: ad-hoc number validation has no counterparty
  vat_number       text NOT NULL,                 -- normalized (no spaces, upper-case, incl. country prefix)
  country_code     text NOT NULL,                 -- ISO alpha-2 parsed from the VAT number (EL→GR)
  is_valid         boolean NOT NULL,
  checked_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,          -- cache TTL boundary
  response_payload jsonb,                         -- normalized provider response (name/address/source/raw)
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  FOREIGN KEY (counterparty_id) REFERENCES counterparties(id)
);
CREATE INDEX idx_vies_vat        ON vies_checks (tenant_id, company_id, vat_number, checked_at DESC);
CREATE INDEX idx_vies_cp         ON vies_checks (tenant_id, company_id, counterparty_id, checked_at DESC);
CREATE INDEX idx_vies_checked_at ON vies_checks (tenant_id, company_id, checked_at DESC);

GRANT SELECT, INSERT ON vies_checks TO app_user;  -- append-only history (no update/delete)

ALTER TABLE vies_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vies_checks FORCE  ROW LEVEL SECURITY;
CREATE POLICY vies_checks_isolation ON vies_checks
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
