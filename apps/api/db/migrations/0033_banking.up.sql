-- =====================================================================
-- 0033 Banking & Reconciliation (Task 3.2)
-- Bank accounts, imported statements, and bank transactions. Transactions are
-- reconciled to AR/AP open items by RECORDING A PAYMENT through the existing
-- PaymentService (no new payment/ledger logic). Company-scoped + RLS throughout.
-- Builds on 0001-0032.
-- =====================================================================

-- ---- bank accounts (company-scoped) ----------------------------------------
CREATE TABLE bank_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL,
  iban        text NOT NULL,
  bic         text,
  bank_name   text,
  currency    text NOT NULL DEFAULT 'EUR',
  is_primary  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, company_id, iban),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);
-- at most ONE primary account per company
CREATE UNIQUE INDEX uq_bank_primary ON bank_accounts (tenant_id, company_id) WHERE is_primary;
CREATE INDEX idx_bank_accounts_active ON bank_accounts (tenant_id, company_id, is_active);

-- ---- imported statements (one per upload) ----------------------------------
CREATE TABLE bank_statements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  company_id       uuid NOT NULL,
  bank_account_id  uuid NOT NULL,
  file_name        text NOT NULL,
  imported_by      uuid,
  imported_at      timestamptz NOT NULL DEFAULT now(),
  statement_from   date,
  statement_to     date,
  row_count        int NOT NULL DEFAULT 0,
  duplicate_count  int NOT NULL DEFAULT 0,
  error_count      int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  FOREIGN KEY (tenant_id, bank_account_id) REFERENCES bank_accounts(tenant_id, id)
);
CREATE INDEX idx_bank_statements_account ON bank_statements (tenant_id, company_id, bank_account_id, imported_at DESC);

-- ---- bank transactions ------------------------------------------------------
CREATE TABLE bank_transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  company_id           uuid NOT NULL,
  bank_statement_id    uuid NOT NULL,
  bank_account_id      uuid NOT NULL,
  booking_date         date NOT NULL,
  value_date           date,
  amount               numeric(20,2) NOT NULL,                 -- signed: + inbound / − outbound
  currency             text NOT NULL DEFAULT 'EUR',
  description          text,
  counterparty_name    text,
  counterparty_iban    text,
  reference            text,
  transaction_type     text NOT NULL CHECK (transaction_type IN ('inbound','outbound')),
  reconciliation_status text NOT NULL DEFAULT 'unreconciled'
                          CHECK (reconciliation_status IN ('unreconciled','reconciled','ignored')),
  matched_payment_id   uuid,
  dedup_hash           text NOT NULL,                          -- sha256 of normalized (account,date,amount,ref,cp)
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  FOREIGN KEY (tenant_id, bank_statement_id) REFERENCES bank_statements(tenant_id, id),
  FOREIGN KEY (tenant_id, bank_account_id) REFERENCES bank_accounts(tenant_id, id),
  FOREIGN KEY (tenant_id, matched_payment_id) REFERENCES payments(tenant_id, id)
);
CREATE INDEX idx_bank_txn_status ON bank_transactions (tenant_id, company_id, reconciliation_status, booking_date DESC);
CREATE INDEX idx_bank_txn_statement ON bank_transactions (tenant_id, company_id, bank_statement_id);
CREATE INDEX idx_bank_txn_account ON bank_transactions (tenant_id, company_id, bank_account_id, booking_date DESC);
-- duplicate detection: a re-imported identical line is rejected per account
CREATE UNIQUE INDEX uq_bank_txn_dedup ON bank_transactions (tenant_id, company_id, bank_account_id, dedup_hash);

GRANT SELECT, INSERT, UPDATE ON bank_accounts    TO app_user;  -- soft delete via is_active
GRANT SELECT, INSERT, UPDATE ON bank_statements   TO app_user;  -- counts finalized post-insert
GRANT SELECT, INSERT, UPDATE ON bank_transactions TO app_user;  -- status/match transitions

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_accounts','bank_statements','bank_transactions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY %1$s_isolation ON %1$I
        USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
        WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
    $f$, t);
  END LOOP;
END $$;
