-- =====================================================================
-- 0010 Rules Engine MVP.
-- rules + rule_versions (versioned, append-only rule defs), accounting_suggestions
-- and vat_suggestions (AI proposals — NEVER ledger entries; Invariant 4/5).
-- Company-scoped + RLS. Builds on 0001-0009.
-- =====================================================================

CREATE TABLE rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL,
  rule_type   text NOT NULL CHECK (rule_type IN ('supplier_account','supplier_vat','keyword_account','default_account')),
  name        text NOT NULL,
  match_key   text,                       -- e.g. supplier EIK, keyword
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_rules_company ON rules (tenant_id, company_id, rule_type, is_active);

CREATE TABLE rule_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL,
  rule_id     uuid NOT NULL,
  version_no  int NOT NULL,
  definition  jsonb NOT NULL,             -- {match:{...}, action:{accountCode|vatCode|...}, confidence}
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, rule_id, version_no),
  FOREIGN KEY (tenant_id, rule_id) REFERENCES rules(tenant_id, id)
);
CREATE TRIGGER rule_versions_immutable BEFORE UPDATE OR DELETE ON rule_versions
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

CREATE TABLE accounting_suggestions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  company_id              uuid NOT NULL,
  document_id             uuid NOT NULL,
  extraction_id           uuid,
  counterparty_id         uuid REFERENCES counterparties(id),
  suggested_account_id    uuid REFERENCES accounts(id),
  suggested_posting       jsonb,          -- proposed entry lines (NOT a journal entry)
  confidence              numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explanation             text,
  status                  text NOT NULL DEFAULT 'suggested'
                            CHECK (status IN ('suggested','accepted','rejected','superseded')),
  is_duplicate            boolean NOT NULL DEFAULT false,
  duplicate_of_document_id uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);
CREATE UNIQUE INDEX uq_current_suggestion ON accounting_suggestions (tenant_id, document_id) WHERE status='suggested';

CREATE TABLE vat_suggestions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  company_id                uuid NOT NULL,
  document_id               uuid NOT NULL,
  accounting_suggestion_id  uuid NOT NULL,
  suggested_vat_code_id     uuid REFERENCES vat_codes(id),
  treatment                 text NOT NULL CHECK (treatment IN
                              ('standard','reduced','zero','exempt','reverse_charge','intra_community','export','import','none')),
  rate                      numeric(5,2),
  confidence                numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explanation               text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id),
  FOREIGN KEY (tenant_id, accounting_suggestion_id) REFERENCES accounting_suggestions(tenant_id, id)
);

GRANT SELECT, INSERT, UPDATE ON rules                  TO app_user;
GRANT SELECT, INSERT         ON rule_versions          TO app_user;  -- immutable
GRANT SELECT, INSERT, UPDATE ON accounting_suggestions TO app_user;
GRANT SELECT, INSERT, UPDATE ON vat_suggestions        TO app_user;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rules','rule_versions','accounting_suggestions','vat_suggestions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
