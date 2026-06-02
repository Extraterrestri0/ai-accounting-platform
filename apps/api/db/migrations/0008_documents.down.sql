DROP POLICY IF EXISTS document_metadata_isolation ON document_metadata;
DROP POLICY IF EXISTS document_versions_isolation ON document_versions;
DROP POLICY IF EXISTS documents_isolation ON documents;
DROP TRIGGER IF EXISTS document_versions_no_truncate ON document_versions;
DROP TRIGGER IF EXISTS document_versions_immutable ON document_versions;
DROP TABLE IF EXISTS document_metadata;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS documents;
