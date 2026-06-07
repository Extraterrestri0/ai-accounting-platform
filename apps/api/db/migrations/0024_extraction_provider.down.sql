ALTER TABLE extraction_runs
  DROP COLUMN IF EXISTS model_version,
  DROP COLUMN IF EXISTS provider;
