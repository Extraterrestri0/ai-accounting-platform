-- =====================================================================
-- 0030 Accounting Period Locking (Task 4.3)
-- A per-company (year, month) period that gates accounting writes. A period is
-- OPEN by default (no row needed); locking inserts/updates a row to 'locked'.
-- Once locked, the application refuses: new postings, payment postings, reversals
-- of entries in that period, VAT rebuilds, invoice issuance and purchase approvals
-- whose accounting date falls in the period. Enforcement is in the application
-- compliance gate (AccountingPeriodService) — this table is the source of truth.
-- Additive; existing data is unaffected (everything reads as OPEN until locked).
-- Builds on 0001-0029.
-- =====================================================================

CREATE TABLE accounting_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL,
  year        int  NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month       int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked')),
  locked_by   uuid,                       -- acting user (mirrors audit actor_id; no FK)
  locked_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, year, month),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_accounting_periods_lookup ON accounting_periods (tenant_id, company_id, year, month);

-- upsert-only (lock / open transitions); no DELETE path
GRANT SELECT, INSERT, UPDATE ON accounting_periods TO app_user;

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods FORCE  ROW LEVEL SECURITY;
CREATE POLICY accounting_periods_isolation ON accounting_periods
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
