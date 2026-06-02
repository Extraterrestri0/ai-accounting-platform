-- =====================================================================
-- 0004 Immutable double-entry ledger (company-scoped, RLS-backed).
-- Builds on 0001-0003 (tenancy + RLS). Enforces, at the DATABASE level:
--   * double-entry: >=2 lines, sum(debit)=sum(credit), non-zero  (deferred check)
--   * immutability: no UPDATE / DELETE / TRUNCATE on entries & lines
--   * corrections: reversing entries only (one reversal per original)
-- A minimal `accounts` table is included so lines can reference accounts;
-- the full chart of accounts is owned by masterdata (Task 007).
-- =====================================================================

-- ---- minimal accounts (masterdata enriches later; mutable) ----
CREATE TABLE accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  company_id     uuid NOT NULL,
  code           text NOT NULL,
  name           text NOT NULL,
  type           text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  status         text NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, id),
  UNIQUE (tenant_id, company_id, code),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

-- ---- per-company monotonic entry numbering ----
CREATE TABLE ledger_entry_counters (
  tenant_id  uuid NOT NULL,
  company_id uuid NOT NULL,
  next_no    bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

-- ---- journal entries (append-only) ----
CREATE TABLE journal_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  company_id            uuid NOT NULL,
  entry_no              bigint NOT NULL,
  posting_date          date NOT NULL,
  description           text NOT NULL DEFAULT '',
  source_type           text NOT NULL DEFAULT 'manual',
  source_ref            text,
  currency              text NOT NULL DEFAULT 'EUR',
  status                text NOT NULL DEFAULT 'posted',
  reverses_entry_id     uuid,
  created_by_actor_type text NOT NULL,
  created_by_actor_id   uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, company_id, entry_no),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  FOREIGN KEY (tenant_id, reverses_entry_id) REFERENCES journal_entries(tenant_id, id)
);
-- one reversal per original
CREATE UNIQUE INDEX uq_reversal_target ON journal_entries (reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
CREATE INDEX idx_entries_company_date ON journal_entries (tenant_id, company_id, posting_date);

-- ---- journal lines (append-only) ----
CREATE TABLE journal_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL,
  entry_id    uuid NOT NULL,
  line_no     int NOT NULL,
  account_id  uuid NOT NULL,
  direction   text NOT NULL CHECK (direction IN ('debit','credit')),
  amount      numeric(20,2) NOT NULL CHECK (amount > 0),  -- exact decimal, never float
  currency    text NOT NULL DEFAULT 'EUR',
  narrative   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_id, line_no),
  FOREIGN KEY (tenant_id, entry_id) REFERENCES journal_entries(tenant_id, id),
  FOREIGN KEY (tenant_id, company_id, account_id) REFERENCES accounts(tenant_id, company_id, id)
);
CREATE INDEX idx_lines_entry ON journal_lines (tenant_id, entry_id);
CREATE INDEX idx_lines_account ON journal_lines (tenant_id, company_id, account_id);

-- ---- immutability: block UPDATE/DELETE/TRUNCATE on the ledger ----
CREATE OR REPLACE FUNCTION app.deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable ledger: % on % is not allowed (use a reversing entry)',
    TG_OP, TG_TABLE_NAME;
END $$;

CREATE TRIGGER journal_entries_immutable BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();
CREATE TRIGGER journal_lines_immutable BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();
CREATE TRIGGER journal_entries_no_truncate BEFORE TRUNCATE ON journal_entries
  FOR EACH STATEMENT EXECUTE FUNCTION app.deny_mutation();
CREATE TRIGGER journal_lines_no_truncate BEFORE TRUNCATE ON journal_lines
  FOR EACH STATEMENT EXECUTE FUNCTION app.deny_mutation();

-- ---- double-entry enforcement: deferred constraint trigger ----
-- Checked at COMMIT, so the entry and all its lines exist by then.
CREATE OR REPLACE FUNCTION app.assert_entry_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d numeric; c numeric; n int;
BEGIN
  SELECT COALESCE(sum(amount) FILTER (WHERE direction='debit'), 0),
         COALESCE(sum(amount) FILTER (WHERE direction='credit'), 0),
         count(*)
    INTO d, c, n
    FROM journal_lines WHERE entry_id = NEW.id;
  IF n < 2 THEN
    RAISE EXCEPTION 'Entry % rejected: double-entry requires >= 2 lines (got %)', NEW.id, n;
  END IF;
  IF d <> c THEN
    RAISE EXCEPTION 'Entry % is unbalanced: debit % <> credit %', NEW.id, d, c;
  END IF;
  IF d = 0 THEN
    RAISE EXCEPTION 'Entry % rejected: zero total', NEW.id;
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER journal_entries_balanced
  AFTER INSERT ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.assert_entry_balanced();

-- ---- grants (app_user; subject to RLS) ----
GRANT SELECT, INSERT, UPDATE ON accounts               TO app_user;  -- masterdata-managed (mutable)
GRANT SELECT, INSERT, UPDATE ON ledger_entry_counters  TO app_user;
GRANT SELECT, INSERT         ON journal_entries        TO app_user;  -- NO update/delete
GRANT SELECT, INSERT         ON journal_lines          TO app_user;  -- NO update/delete

-- ---- RLS (company-scoped): tenant AND company must match ----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','ledger_entry_counters','journal_entries','journal_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
