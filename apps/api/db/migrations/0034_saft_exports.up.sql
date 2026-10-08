-- =====================================================================
-- 0034 SAF-T Engine v1 — generated dataset store (Task: SAF-T Ready Data)
-- saft_exports holds the normalized, SAF-T-ready dataset (JSON) for a company/month
-- plus the validation summary. v1 builds the STRUCTURED dataset (not final XML) by
-- READING existing immutable sources (ledger, invoices, purchases, payments, master
-- data) — nothing else is changed. Append-only history; company-scoped + RLS.
-- Builds on 0001-0033.
-- =====================================================================

CREATE TABLE saft_exports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  year               int  NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month              int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  status             text NOT NULL CHECK (status IN ('generated','failed')),
  generated_by       uuid,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  dataset_json       jsonb,             -- the normalized SAF-T-ready dataset (null on failure)
  validation_summary jsonb,            -- { errors[], warnings[], info[], counts }
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_saft_exports_period ON saft_exports (tenant_id, company_id, year, month, generated_at DESC);
CREATE INDEX idx_saft_exports_recent ON saft_exports (tenant_id, company_id, generated_at DESC);

GRANT SELECT, INSERT ON saft_exports TO app_user;  -- append-only export history

ALTER TABLE saft_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saft_exports FORCE  ROW LEVEL SECURITY;
CREATE POLICY saft_exports_isolation ON saft_exports
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
