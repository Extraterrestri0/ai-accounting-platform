-- =====================================================================
-- 0007 Master Data: chart-of-accounts enrichment, counterparties, VAT codes,
-- company settings (all company-scoped + RLS), and GLOBAL reference data
-- (countries, currencies — universal, read-only, not tenant data so not RLS).
-- Builds on 0001-0006. No redesign of prior tables beyond additive columns.
-- =====================================================================

-- ---- GLOBAL reference: countries (ISO-3166-1 alpha-2) ----
CREATE TABLE countries (
  code   text PRIMARY KEY,          -- ISO alpha-2
  name   text NOT NULL,
  is_eu  boolean NOT NULL DEFAULT false
);
INSERT INTO countries(code,name,is_eu) VALUES
 ('BG','Bulgaria',true),('DE','Germany',true),('FR','France',true),('GR','Greece',true),
 ('RO','Romania',true),('IT','Italy',true),('ES','Spain',true),('NL','Netherlands',true),
 ('AT','Austria',true),('PL','Poland',true),('GB','United Kingdom',false),
 ('US','United States',false),('CH','Switzerland',false),('TR','Turkey',false),('RS','Serbia',false);

-- ---- GLOBAL reference: currencies (ISO-4217) ----
CREATE TABLE currencies (
  code        text PRIMARY KEY,     -- ISO alpha-3
  name        text NOT NULL,
  minor_units int NOT NULL DEFAULT 2
);
INSERT INTO currencies(code,name,minor_units) VALUES
 ('EUR','Euro',2),('BGN','Bulgarian lev',2),('USD','US dollar',2),('GBP','Pound sterling',2);

GRANT SELECT ON countries, currencies TO app_user;  -- read-only reference (no tenant data)

-- ---- chart of accounts: additive enrichment of accounts (Task 004) ----
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS parent_account_id uuid,
  ADD COLUMN IF NOT EXISTS category text,            -- BG plan group, e.g. 'III. Разчети'
  ADD COLUMN IF NOT EXISTS is_postable boolean NOT NULL DEFAULT true;  -- false = group/header
ALTER TABLE accounts
  ADD CONSTRAINT accounts_parent_fk
  FOREIGN KEY (tenant_id, company_id, parent_account_id)
  REFERENCES accounts(tenant_id, company_id, id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(tenant_id, company_id, parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_name   ON accounts(tenant_id, company_id, lower(name));

-- ---- VAT codes (company-scoped) ----
CREATE TABLE vat_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL,
  code        text NOT NULL,
  description text NOT NULL,
  kind        text NOT NULL CHECK (kind IN
                ('standard','reduced','zero','exempt','reverse_charge','intra_community','export','import')),
  rate        numeric(5,2) NOT NULL DEFAULT 0,   -- e.g. 20.00, 9.00, 0.00
  direction   text NOT NULL DEFAULT 'both' CHECK (direction IN ('sales','purchase','both')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, code),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

-- ---- counterparties (company-scoped): customers / suppliers / both ----
CREATE TABLE counterparties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  company_id   uuid NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('customer','supplier','both')),
  name         text NOT NULL,
  eik          text,                 -- Bulgarian EIK/BULSTAT (validated in app)
  vat_number   text,                 -- e.g. BG + digits (validated in app; VIES later)
  country_code text NOT NULL DEFAULT 'BG' REFERENCES countries(code),
  address_line text,
  city         text,
  postal_code  text,
  email        text,
  iban         text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
-- duplicate detection (DB backstop, app checks first for friendly errors)
CREATE UNIQUE INDEX uq_cp_eik ON counterparties (tenant_id, company_id, eik) WHERE eik IS NOT NULL;
CREATE UNIQUE INDEX uq_cp_vat ON counterparties (tenant_id, company_id, vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX idx_cp_name ON counterparties (tenant_id, company_id, lower(name));
CREATE INDEX idx_cp_kind ON counterparties (tenant_id, company_id, kind);

-- ---- company settings (company-scoped, one row per company) ----
CREATE TABLE company_settings (
  tenant_id            uuid NOT NULL,
  company_id           uuid NOT NULL,
  vat_registered       boolean NOT NULL DEFAULT false,
  vat_number           text,
  vat_registration_date date,
  default_currency     text NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  fiscal_year_start_month int NOT NULL DEFAULT 1,
  accounting_basis     text NOT NULL DEFAULT 'accrual' CHECK (accounting_basis IN ('accrual','cash')),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

GRANT SELECT, INSERT, UPDATE ON vat_codes        TO app_user;
GRANT SELECT, INSERT, UPDATE ON counterparties   TO app_user;
GRANT SELECT, INSERT, UPDATE ON company_settings TO app_user;

-- ---- RLS (company-scoped) on the new tenant tables ----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vat_codes','counterparties','company_settings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
