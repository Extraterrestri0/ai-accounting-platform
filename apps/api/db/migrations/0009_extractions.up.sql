-- =====================================================================
-- 0009 OCR & Extraction Pipeline.
-- extraction_runs (one per attempt; concurrency-guarded), document_extractions
-- (one consolidated result per run; one 'current' per document), extraction_fields
-- (append-only per-field values + confidence). Company-scoped + RLS. Builds on 0001-0008.
-- AI/OCR writes ONLY here (never the ledger) — Invariant 4.
-- =====================================================================

CREATE TABLE extraction_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  document_id        uuid NOT NULL,
  method             text NOT NULL CHECK (method IN ('ocr','xml','hybrid')),
  engine             text NOT NULL,                 -- e.g. 'stub-ocr@dev', 'ubl-xml', vendor id
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed')),
  overall_confidence numeric(4,3) CHECK (overall_confidence IS NULL OR (overall_confidence >= 0 AND overall_confidence <= 1)),
  error              text,
  started_at         timestamptz,
  finished_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);
-- duplicate-extraction prevention: at most one active run per document
CREATE UNIQUE INDEX uq_active_run ON extraction_runs (tenant_id, document_id) WHERE status IN ('pending','running');
CREATE INDEX idx_runs_document ON extraction_runs (tenant_id, document_id);

CREATE TABLE document_extractions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  document_id        uuid NOT NULL,
  run_id             uuid NOT NULL,
  doc_type           text NOT NULL DEFAULT 'invoice' CHECK (doc_type IN ('invoice','credit_note','receipt','other')),
  overall_confidence numeric(4,3) NOT NULL CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
  status             text NOT NULL DEFAULT 'extracted' CHECK (status IN ('extracted','superseded')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_id),                        -- one extraction per run
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id),
  FOREIGN KEY (tenant_id, run_id) REFERENCES extraction_runs(tenant_id, id)
);
-- exactly one current extraction per document
CREATE UNIQUE INDEX uq_current_extraction ON document_extractions (tenant_id, document_id) WHERE status='extracted';

CREATE TABLE extraction_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  extraction_id     uuid NOT NULL,
  field_key         text NOT NULL CHECK (field_key IN (
                      'supplier_name','supplier_vat','supplier_eik','customer_name',
                      'invoice_number','invoice_date','due_date','currency',
                      'net_amount','vat_amount','total_amount','iban','payment_reference')),
  value_text        text,
  value_normalized  text,
  confidence        numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source            text NOT NULL CHECK (source IN ('ocr','xml','derived')),
  validation_status text NOT NULL DEFAULT 'unchecked' CHECK (validation_status IN ('valid','invalid','warning','unchecked')),
  bbox              jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, extraction_id, field_key),
  FOREIGN KEY (tenant_id, extraction_id) REFERENCES document_extractions(tenant_id, id)
);

-- extraction_fields are append-only (the AI's raw output is a record; corrections live in review/Task 010)
CREATE TRIGGER extraction_fields_immutable BEFORE UPDATE OR DELETE ON extraction_fields
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

GRANT SELECT, INSERT, UPDATE ON extraction_runs        TO app_user;  -- status transitions
GRANT SELECT, INSERT, UPDATE ON document_extractions   TO app_user;  -- supersede
GRANT SELECT, INSERT         ON extraction_fields       TO app_user;  -- immutable

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['extraction_runs','document_extractions','extraction_fields'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
