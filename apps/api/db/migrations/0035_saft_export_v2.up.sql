-- =====================================================================
-- 0035 SAF-T Engine v2 — async export lifecycle + downloadable artifacts
-- EXPAND step (expand-contract): purely ADDITIVE and backward-compatible with
-- v1. v1 keeps writing status 'generated'/'failed' and reading the same columns;
-- nothing here mutates existing rows. A later CONTRACT migration will backfill
-- 'generated' -> 'completed' and drop the legacy value once the app no longer
-- writes it. Builds on 0034.
--
-- NOTE on mutability: the EXPORT JOB ROW (saft_exports) becomes a mutable state
-- record (queued -> processing -> completed/failed) — this is intentional and is
-- NOT the ledger/audit. The generated ARTIFACTS (saft_export_artifacts) and the
-- audit chain remain strictly write-once. UPDATE is granted column-scoped so the
-- row's identity (tenant/company/period/id) can never change.
-- =====================================================================

-- ---- saft_exports: widen status + add v2 lifecycle columns ----
ALTER TABLE saft_exports DROP CONSTRAINT IF EXISTS saft_exports_status_check;
ALTER TABLE saft_exports ADD CONSTRAINT saft_exports_status_check
  CHECK (status IN ('generated','queued','processing','completed','failed')); -- 'generated' kept for back-compat

ALTER TABLE saft_exports
  ADD COLUMN IF NOT EXISTS requested_by    uuid,
  ADD COLUMN IF NOT EXISTS requested_at    timestamptz,
  ADD COLUMN IF NOT EXISTS started_at      timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error      text,
  ADD COLUMN IF NOT EXISTS schema_version  text,
  ADD COLUMN IF NOT EXISTS xsd_valid       boolean;  -- null = not validated (no XSD bound)

-- The state machine (Phase 2) advances status/timestamps; the worker (Phase 3+)
-- fills dataset/validation. Column-scoped so identity columns stay immutable.
GRANT UPDATE (status, generated_at, started_at, completed_at, attempt_count,
              last_error, schema_version, xsd_valid, dataset_json, validation_summary, error)
  ON saft_exports TO app_user;

CREATE INDEX IF NOT EXISTS idx_saft_exports_status ON saft_exports (tenant_id, company_id, status, requested_at DESC);

-- ---- saft_export_artifacts: immutable, downloadable generated files ----
-- One export may have several artifacts (e.g. dataset_json snapshot + the .xml).
-- Append-only (SELECT,INSERT only); company-scoped + RLS. sha256 gives integrity;
-- worm_retain_until records the Object-Lock retention applied in storage.
CREATE TABLE saft_export_artifacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  export_id         uuid NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('xml','dataset_json')),
  storage_key       text NOT NULL,
  content_type      text NOT NULL,
  size_bytes        bigint NOT NULL DEFAULT 0,
  sha256            text,
  xsd_valid         boolean,           -- null = not validated; mirrors the validation outcome for this file
  xsd_errors        jsonb,
  worm_retain_until timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, export_id) REFERENCES saft_exports(tenant_id, id)
);
CREATE INDEX idx_saft_artifacts_export ON saft_export_artifacts (tenant_id, company_id, export_id, created_at DESC);

GRANT SELECT, INSERT ON saft_export_artifacts TO app_user;  -- append-only

ALTER TABLE saft_export_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saft_export_artifacts FORCE  ROW LEVEL SECURITY;
CREATE POLICY saft_export_artifacts_isolation ON saft_export_artifacts
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
