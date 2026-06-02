-- =====================================================================
-- 0008 Document Upload Center.
-- documents (mutable status + current-version pointer), document_versions
-- (append-only/immutable, content-addressed by checksum), document_metadata
-- (mutable; scan + detected type). Company-scoped + RLS. Builds on 0001-0007.
-- Storage bytes live in object storage (S3 Object-Lock/WORM in prod; the DB
-- holds keys + checksums only).
-- =====================================================================

CREATE TABLE documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  original_filename text NOT NULL,
  mime_type         text NOT NULL,
  size_bytes        bigint,
  status            text NOT NULL DEFAULT 'pending_upload'
                      CHECK (status IN ('pending_upload','uploaded','scanning','ready','quarantined','failed')),
  storage_key       text,                 -- key of the current version's object
  checksum_sha256   text,
  counterparty_id   uuid REFERENCES counterparties(id),  -- usually set later by extraction
  document_date     date,
  source            text NOT NULL DEFAULT 'upload',
  uploaded_by       uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_documents_company_status ON documents (tenant_id, company_id, status);
CREATE INDEX idx_documents_filename ON documents (tenant_id, company_id, lower(original_filename));
CREATE INDEX idx_documents_created ON documents (tenant_id, company_id, created_at DESC);

CREATE TABLE document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  company_id      uuid NOT NULL,
  document_id     uuid NOT NULL,
  version_no      int NOT NULL,
  storage_key     text NOT NULL,
  checksum_sha256 text NOT NULL,
  size_bytes      bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_id, version_no),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);
CREATE INDEX idx_doc_versions ON document_versions (tenant_id, document_id, version_no);

CREATE TABLE document_metadata (
  document_id          uuid PRIMARY KEY REFERENCES documents(id),
  tenant_id            uuid NOT NULL,
  company_id           uuid NOT NULL,
  detected_type        text,                 -- magic-byte result: pdf|png|jpeg|tiff|xml
  page_count           int,
  scan_status          text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','error')),
  scan_engine          text,
  scanned_at           timestamptz,
  extra                jsonb,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- immutability: document_versions are append-only (reuse app.deny_mutation from 0004)
CREATE TRIGGER document_versions_immutable BEFORE UPDATE OR DELETE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();
CREATE TRIGGER document_versions_no_truncate BEFORE TRUNCATE ON document_versions
  FOR EACH STATEMENT EXECUTE FUNCTION app.deny_mutation();

GRANT SELECT, INSERT, UPDATE ON documents          TO app_user;  -- status/pointer updates allowed
GRANT SELECT, INSERT         ON document_versions  TO app_user;  -- immutable: no update/delete
GRANT SELECT, INSERT, UPDATE ON document_metadata  TO app_user;

-- RLS (company-scoped)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents','document_versions','document_metadata'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
