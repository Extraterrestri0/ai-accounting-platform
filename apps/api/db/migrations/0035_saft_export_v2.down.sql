-- =====================================================================
-- 0035 DOWN — revert the v2 export lifecycle + artifacts (dev rollback).
-- Drops the artifacts table, the UPDATE grant, the added columns, and narrows
-- the status CHECK back to the v1 values. NOTE: re-adding the v1 CHECK will fail
-- if any row already holds a v2-only status ('queued'/'processing'/'completed') —
-- intended for rollback before such rows exist.
-- =====================================================================
DROP TABLE IF EXISTS saft_export_artifacts;

REVOKE UPDATE ON saft_exports FROM app_user;

DROP INDEX IF EXISTS idx_saft_exports_status;

ALTER TABLE saft_exports DROP CONSTRAINT IF EXISTS saft_exports_status_check;
ALTER TABLE saft_exports ADD CONSTRAINT saft_exports_status_check
  CHECK (status IN ('generated','failed'));

ALTER TABLE saft_exports
  DROP COLUMN IF EXISTS requested_by,
  DROP COLUMN IF EXISTS requested_at,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS attempt_count,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS schema_version,
  DROP COLUMN IF EXISTS xsd_valid;
