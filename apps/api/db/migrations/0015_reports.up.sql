-- =====================================================================
-- 0015 Financial Reports.
-- report_runs (audit trail of report generation) + report_snapshots (append-only
-- point-in-time computed datasets). Reports READ the immutable ledger / invoices /
-- VAT registers and write only these two tables. Company-scoped + RLS. Builds on 0001-0014.
-- =====================================================================

CREATE TABLE report_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  company_id    uuid NOT NULL,
  report_type   text NOT NULL CHECK (report_type IN
                  ('trial_balance','general_ledger','account_card','journal','profit_and_loss','balance_sheet','vat','invoice')),
  params        jsonb,
  status        text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  generated_by  uuid,
  error         text,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_report_runs ON report_runs (tenant_id, company_id, report_type, generated_at DESC);

CREATE TABLE report_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  company_id      uuid NOT NULL,
  report_run_id   uuid NOT NULL,
  report_type     text NOT NULL,
  period_start    date,
  period_end      date,
  payload         jsonb NOT NULL,                  -- the computed, export-ready dataset
  checksum_sha256 text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, report_run_id) REFERENCES report_runs(tenant_id, id)
);
CREATE INDEX idx_report_snapshots ON report_snapshots (tenant_id, company_id, report_type, period_end DESC);
-- snapshots are an immutable, point-in-time record
CREATE TRIGGER report_snapshots_immutable BEFORE UPDATE OR DELETE ON report_snapshots
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

GRANT SELECT, INSERT ON report_runs       TO app_user;
GRANT SELECT, INSERT ON report_snapshots  TO app_user;  -- append-only

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['report_runs','report_snapshots'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
