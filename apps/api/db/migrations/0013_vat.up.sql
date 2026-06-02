-- =====================================================================
-- 0013 VAT Module MVP (Bulgarian VAT registers + return dataset).
-- vat_periods (monthly), vat_register_entries (derived purchase/sales rows,
-- append-only snapshot of posted entries), vat_returns (period summary + СД dataset).
-- Reads the IMMUTABLE ledger; writes only its own tables. Company-scoped + RLS. Builds on 0001-0012.
-- =====================================================================

CREATE TABLE vat_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  company_id    uuid NOT NULL,
  period_year   int  NOT NULL,
  period_month  int  NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','submitted')),
  starts_on     date NOT NULL,
  ends_on       date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, company_id, period_year, period_month),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

CREATE TABLE vat_register_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL,
  period_id         uuid NOT NULL,
  journal_entry_id  uuid NOT NULL,
  register_kind     text NOT NULL CHECK (register_kind IN ('purchase','sales')),
  counterparty_id   uuid,
  document_ref      text,
  document_date     date,
  vat_code_id       uuid REFERENCES vat_codes(id),
  treatment         text NOT NULL CHECK (treatment IN
                      ('standard','reduced','zero','exempt','reverse_charge','intra_community','export','import','none')),
  base_amount       numeric(20,2) NOT NULL DEFAULT 0,
  vat_amount        numeric(20,2) NOT NULL DEFAULT 0,
  deductible_amount numeric(20,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, journal_entry_id, register_kind),       -- no duplicate register rows per posted entry
  FOREIGN KEY (tenant_id, period_id) REFERENCES vat_periods(tenant_id, id),
  FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id)
);
CREATE INDEX idx_vat_register ON vat_register_entries (tenant_id, company_id, period_id, register_kind);
-- derived snapshot is append-only (rebuild = new period build after clearing draft; immutability protects filed data)
CREATE TRIGGER vat_register_immutable BEFORE UPDATE OR DELETE ON vat_register_entries
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

CREATE TABLE vat_returns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  company_id      uuid NOT NULL,
  period_id       uuid NOT NULL,
  output_vat      numeric(20,2) NOT NULL DEFAULT 0,
  deductible_vat  numeric(20,2) NOT NULL DEFAULT 0,
  vat_payable     numeric(20,2) NOT NULL DEFAULT 0,
  vat_refundable  numeric(20,2) NOT NULL DEFAULT 0,
  dataset         jsonb,                                     -- СД по ЗДДС cells (MVP subset)
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  generated_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_id),
  FOREIGN KEY (tenant_id, period_id) REFERENCES vat_periods(tenant_id, id)
);

GRANT SELECT, INSERT, UPDATE ON vat_periods           TO app_user;
GRANT SELECT, INSERT         ON vat_register_entries  TO app_user;  -- append-only
GRANT SELECT, INSERT, UPDATE ON vat_returns           TO app_user;  -- regenerate draft

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vat_periods','vat_register_entries','vat_returns'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
