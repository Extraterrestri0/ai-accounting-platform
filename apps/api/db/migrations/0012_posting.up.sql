-- =====================================================================
-- 0012 Posting Workflow.
-- posting_requests (a human-authorized request to post an approved review) and
-- posting_results (the link to the created/reversed journal entry). The actual
-- entry lives in the immutable ledger (0004); these tables are the workflow trail.
-- Company-scoped + RLS. Builds on 0001-0011.
-- =====================================================================

CREATE TABLE posting_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  review_package_id  uuid,
  document_id        uuid,
  requested_by       uuid NOT NULL,                 -- human (Invariant 4/5)
  kind               text NOT NULL DEFAULT 'post' CHECK (kind IN ('post','reversal')),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed')),
  lines              jsonb,                          -- resolved {accountId,direction,amount} snapshot
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, review_package_id) REFERENCES review_packages(tenant_id, id)
);
CREATE INDEX idx_posting_requests ON posting_requests (tenant_id, company_id, status, created_at DESC);
-- at most one SUCCESSFUL posting per review package (no double-posting)
CREATE UNIQUE INDEX uq_posted_per_review ON posting_requests (tenant_id, review_package_id)
  WHERE status='posted' AND kind='post' AND review_package_id IS NOT NULL;

CREATE TABLE posting_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  company_id              uuid NOT NULL,
  posting_request_id      uuid NOT NULL,
  journal_entry_id        uuid NOT NULL,
  reverses_entry_id       uuid,
  posted_at               timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, posting_request_id) REFERENCES posting_requests(tenant_id, id),
  FOREIGN KEY (tenant_id, journal_entry_id)   REFERENCES journal_entries(tenant_id, id)
);
CREATE INDEX idx_posting_results ON posting_results (tenant_id, company_id, journal_entry_id);
-- posting_results are an append-only record of outcomes
CREATE TRIGGER posting_results_immutable BEFORE UPDATE OR DELETE ON posting_results
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

GRANT SELECT, INSERT, UPDATE ON posting_requests TO app_user;  -- status transitions
GRANT SELECT, INSERT         ON posting_results  TO app_user;  -- append-only

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posting_requests','posting_results'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
