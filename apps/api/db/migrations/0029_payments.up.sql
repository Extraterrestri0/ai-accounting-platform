-- =====================================================================
-- 0029 Payments (Task 3.1 — Receivables & Payables Engine)
-- A single append-only ledger of settlement events against an AR or AP document.
--   * payment_type  inbound  = customer paid us (settles a sales document)
--                   outbound = we paid a supplier (settles a purchase document)
--   * document_type sales_invoice  -> document_id = invoices.id
--                   purchase_invoice -> document_id = the posted purchase journal_entries.id
-- Supports PARTIAL + MULTIPLE payments (many rows per document) and full payment
-- HISTORY (rows are never deleted). A reversal flips status to 'reversed' and the
-- linked ledger entry is offset by a reversing journal entry (immutable ledger).
-- Outstanding balance = document total − Σ(active payments). Company-scoped + RLS.
-- Builds on 0001-0028.
-- =====================================================================

CREATE TABLE payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  company_id           uuid NOT NULL,
  payment_type         text NOT NULL CHECK (payment_type IN ('inbound','outbound')),
  document_type        text NOT NULL CHECK (document_type IN ('sales_invoice','purchase_invoice')),
  document_id          uuid NOT NULL,                 -- polymorphic (invoices.id | journal_entries.id); discriminated by document_type
  counterparty_id      uuid REFERENCES counterparties(id),
  amount               numeric(20,2) NOT NULL CHECK (amount > 0),  -- exact decimal, never float
  currency             text NOT NULL DEFAULT 'EUR',
  payment_date         date NOT NULL,
  reference            text,                          -- bank reference / payment order no
  notes                text,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reversed')),
  journal_entry_id     uuid,                          -- the settlement entry in the immutable ledger
  reversed_by_payment_id uuid,                        -- set on the original when reversed
  created_by           uuid NOT NULL,                 -- human actor (mirrors audit actor_id)
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id)      REFERENCES companies(tenant_id, id),
  FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id),
  FOREIGN KEY (tenant_id, reversed_by_payment_id) REFERENCES payments(tenant_id, id)
);
CREATE INDEX idx_payments_document     ON payments (tenant_id, company_id, document_type, document_id, status);
CREATE INDEX idx_payments_date         ON payments (tenant_id, company_id, payment_date DESC);
CREATE INDEX idx_payments_counterparty ON payments (tenant_id, company_id, counterparty_id);

-- append-only history: rows are inserted and (only) status-transitioned; never deleted.
GRANT SELECT, INSERT, UPDATE ON payments TO app_user;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE  ROW LEVEL SECURITY;
CREATE POLICY payments_isolation ON payments
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
