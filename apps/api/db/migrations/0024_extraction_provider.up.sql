-- =====================================================================
-- 0024 Extraction provider traceability (Task 1.1 — Production OCR)
-- Records WHICH Document-AI provider + model produced each extraction run so
-- every AI output is traceable (model + version) and auditable per Invariant.
-- Additive + nullable → existing runs and the current extraction flow are
-- completely unaffected (engine text column is kept as the human-readable id).
-- =====================================================================

ALTER TABLE extraction_runs
  ADD COLUMN IF NOT EXISTS provider      text,   -- 'pdfjs' | 'azure' | 'http' | 'dev' | 'stub' | 'xml'
  ADD COLUMN IF NOT EXISTS model_version text;   -- e.g. 'prebuilt-invoice/2023-07-31'
