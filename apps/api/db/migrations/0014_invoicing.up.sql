-- =====================================================================
-- 0014 Invoice Issuance (standard sales invoices, MVP).
-- invoice_numbering_series (gapless per company/year/series), invoices + invoice_lines
-- (draft mutable, issued IMMUTABLE), invoice_pdf_artifacts (append-only),
-- invoice_email_deliveries. Posts to the ledger + feeds the sales VAT register on issue.
-- Company-scoped + RLS. Builds on 0001-0013.
-- =====================================================================

CREATE TABLE invoice_numbering_series (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  company_id   uuid NOT NULL,
  series_code  text NOT NULL DEFAULT 'A',
  series_year  int  NOT NULL,
  prefix       text NOT NULL DEFAULT '',
  next_number  bigint NOT NULL DEFAULT 1,          -- gapless counter; only advances on successful issue
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, company_id, series_code, series_year),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  company_id      uuid NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued')),
  customer_id     uuid REFERENCES counterparties(id),
  customer_name   text,
  series_code     text NOT NULL DEFAULT 'A',
  series_year     int,
  invoice_number  text,                              -- assigned ONLY on issue
  issue_date      date,
  due_date        date,
  currency        text NOT NULL DEFAULT 'EUR',
  net_total       numeric(20,2) NOT NULL DEFAULT 0,
  vat_total       numeric(20,2) NOT NULL DEFAULT 0,
  gross_total     numeric(20,2) NOT NULL DEFAULT 0,
  notes           text,
  journal_entry_id uuid,                             -- set when posted to the ledger
  issued_by       uuid,
  issued_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  -- gapless + unique issued number per company/series/year
  UNIQUE (tenant_id, company_id, series_code, series_year, invoice_number),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
CREATE INDEX idx_invoices_company ON invoices (tenant_id, company_id, status, created_at DESC);

CREATE TABLE invoice_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  company_id    uuid NOT NULL,
  invoice_id    uuid NOT NULL,
  line_no       int  NOT NULL,
  description   text NOT NULL,
  quantity      numeric(20,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    numeric(20,2) NOT NULL CHECK (unit_price >= 0),
  vat_code_id   uuid REFERENCES vat_codes(id),
  vat_rate      numeric(5,2) NOT NULL DEFAULT 0,
  net_amount    numeric(20,2) NOT NULL DEFAULT 0,
  vat_amount    numeric(20,2) NOT NULL DEFAULT 0,
  gross_amount  numeric(20,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_id, line_no),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
);

CREATE TABLE invoice_pdf_artifacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  company_id     uuid NOT NULL,
  invoice_id     uuid NOT NULL,
  storage_key    text NOT NULL,
  checksum_sha256 text,
  content_type   text NOT NULL DEFAULT 'application/pdf',
  generated_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
);
CREATE TRIGGER invoice_pdf_immutable BEFORE UPDATE OR DELETE ON invoice_pdf_artifacts
  FOR EACH ROW EXECUTE FUNCTION app.deny_mutation();

CREATE TABLE invoice_email_deliveries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  invoice_id         uuid NOT NULL,
  to_email           text NOT NULL,
  status             text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','delivered')),
  provider_message_id text,
  error              text,
  queued_at          timestamptz NOT NULL DEFAULT now(),
  sent_at            timestamptz,
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
);
CREATE INDEX idx_invoice_email ON invoice_email_deliveries (tenant_id, invoice_id, status);

-- Issued invoices are immutable: block UPDATE/DELETE once status='issued'
-- (the draft→issued transition itself is allowed because OLD.status is still 'draft').
CREATE OR REPLACE FUNCTION app.deny_when_issued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'issued' THEN RAISE EXCEPTION 'Issued invoice % is immutable', OLD.id; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'issued' THEN
    -- allow ONLY the one-time link of the posted journal entry
    IF NEW.status = 'issued' AND NEW.invoice_number IS NOT DISTINCT FROM OLD.invoice_number
       AND NEW.net_total = OLD.net_total AND NEW.gross_total = OLD.gross_total
       AND OLD.journal_entry_id IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Issued invoice % is immutable', OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_immutable_when_issued BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION app.deny_when_issued();

-- Invoice lines become immutable once the parent invoice is issued.
CREATE OR REPLACE FUNCTION app.deny_line_when_issued() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pstatus text;
BEGIN
  SELECT status INTO pstatus FROM invoices WHERE id = COALESCE(OLD.invoice_id, NEW.invoice_id);
  IF pstatus = 'issued' THEN RAISE EXCEPTION 'Lines of an issued invoice are immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER invoice_lines_immutable_when_issued BEFORE UPDATE OR DELETE ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION app.deny_line_when_issued();

GRANT SELECT, INSERT, UPDATE ON invoice_numbering_series  TO app_user;
GRANT SELECT, INSERT, UPDATE ON invoices                  TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_lines     TO app_user;  -- draft edits; trigger blocks issued
GRANT SELECT, INSERT         ON invoice_pdf_artifacts      TO app_user;  -- append-only
GRANT SELECT, INSERT, UPDATE ON invoice_email_deliveries   TO app_user;  -- delivery status transitions

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoice_numbering_series','invoices','invoice_lines','invoice_pdf_artifacts','invoice_email_deliveries'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
