-- =====================================================================
-- 0011 Review Queue — the human approval checkpoint before posting.
-- review_packages (one per document; lifecycle), review_actions (append-only,
-- HUMAN-ONLY — DB CHECK enforces actor_type='user' so AI can never approve/reject),
-- review_comments (append-only). Company-scoped + RLS. Builds on 0001-0010.
-- =====================================================================

CREATE TABLE review_packages (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL,
  company_id             uuid NOT NULL,
  document_id            uuid NOT NULL,
  extraction_id          uuid,
  accounting_suggestion_id uuid,
  status                 text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected','needs_correction')),
  assigned_reviewer_id   uuid,
  approved_account_id    uuid REFERENCES accounts(id),
  approved_vat_code_id   uuid REFERENCES vat_codes(id),
  approved_posting       jsonb,                 -- human-approved (possibly edited) entry lines
  decided_by             uuid,
  decided_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, document_id),             -- one review package per document
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);
CREATE INDEX idx_review_queue ON review_packages (tenant_id, company_id, status, created_at DESC);
CREATE INDEX idx_review_assignee ON review_packages (tenant_id, company_id, assigned_reviewer_id);

CREATE TABLE review_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  review_package_id uuid NOT NULL,
  action_type       text NOT NULL CHECK (action_type IN ('approve','reject','edit','request_correction','assign','comment')),
  actor_type        text NOT NULL DEFAULT 'user' CHECK (actor_type = 'user'),  -- AI/system CANNOT act (Invariant 4/5)
  actor_id          uuid NOT NULL,
  payload           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, review_package_id) REFERENCES review_packages(tenant_id, id)
);
CREATE INDEX idx_review_actions_pkg ON review_actions (tenant_id, review_package_id, created_at);
CREATE TRIGGER review_actions_immutable BEFORE UPDATE OR DELETE ON review_actions
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

CREATE TABLE review_comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  review_package_id uuid NOT NULL,
  author_id         uuid NOT NULL,
  body              text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, review_package_id) REFERENCES review_packages(tenant_id, id)
);
CREATE INDEX idx_review_comments_pkg ON review_comments (tenant_id, review_package_id, created_at);
CREATE TRIGGER review_comments_immutable BEFORE UPDATE OR DELETE ON review_comments
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

GRANT SELECT, INSERT, UPDATE ON review_packages TO app_user;
GRANT SELECT, INSERT         ON review_actions  TO app_user;  -- append-only
GRANT SELECT, INSERT         ON review_comments TO app_user;  -- append-only

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['review_packages','review_actions','review_comments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
