DROP POLICY IF EXISTS extraction_fields_isolation ON extraction_fields;
DROP POLICY IF EXISTS document_extractions_isolation ON document_extractions;
DROP POLICY IF EXISTS extraction_runs_isolation ON extraction_runs;
DROP TRIGGER IF EXISTS extraction_fields_immutable ON extraction_fields;
DROP TABLE IF EXISTS extraction_fields;
DROP TABLE IF EXISTS document_extractions;
DROP TABLE IF EXISTS extraction_runs;
