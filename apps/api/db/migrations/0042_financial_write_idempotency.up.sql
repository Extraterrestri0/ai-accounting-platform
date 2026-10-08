-- =====================================================================
-- 0042 Financial-write idempotency (P0 — Pass 1A).
-- A durable, DB-backed dedupe record for money-moving operations
-- (payment recording, bank reconciliation settlement, manual ledger
-- posting/reversal). The UNIQUE key is the concurrency guarantee:
-- a repeated request with the same (tenant, company, operation, key)
-- either returns the stored result (same fingerprint) or is refused
-- (different fingerprint). The row is inserted and completed INSIDE the
-- same transaction as the payment/journal it guards, so it commits with
-- them or not at all — a rolled-back attempt frees the key for retry.
-- Additive, metadata-only (no table rewrite). No historical backfill.
-- =====================================================================
CREATE TABLE financial_write_idempotency (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  company_id           uuid NOT NULL,
  operation            text NOT NULL,          -- 'payment.record' | 'bank.reconcile' | 'ledger.post' | 'ledger.reverse'
  idempotency_key      text NOT NULL,          -- opaque client/derived key
  request_fingerprint  text NOT NULL,          -- sha256 hex of the canonical request payload
  result_json          jsonb,                  -- {paymentId?, journalEntryId?} — set when the guarded op completes (same txn)
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, operation, idempotency_key),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

-- app_user inserts the claim and records the result in the same txn. UPDATE is column-scoped to
-- result_json only (the claim's scope, key and fingerprint can never be rewritten); no DELETE.
GRANT SELECT, INSERT ON financial_write_idempotency TO app_user;
GRANT UPDATE (result_json) ON financial_write_idempotency TO app_user;

-- RLS: company-scoped, same pattern as every tenant table (fail-closed without context).
ALTER TABLE financial_write_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_write_idempotency FORCE  ROW LEVEL SECURITY;
CREATE POLICY financial_write_idempotency_isolation ON financial_write_idempotency
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());
