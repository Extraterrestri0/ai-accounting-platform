-- =====================================================================
-- 0025 Product / Service Catalog (Task 2.1)
-- Company-scoped reusable items: Code, Description, Unit, VAT Rate, SAF-T Code,
-- Default Account (+ kind product/service). Invoice lines may LINK to a catalog
-- item (snapshotting description/vat/unit/saft on the line) or stay free-text
-- (catalog_item_id NULL). Additive; existing invoices/lines are unaffected.
-- Builds on 0001-0024.
-- =====================================================================

CREATE TABLE catalog_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  company_id         uuid NOT NULL,
  code               text NOT NULL,
  description        text NOT NULL,
  kind               text NOT NULL DEFAULT 'service' CHECK (kind IN ('product','service')),
  unit               text NOT NULL DEFAULT 'pcs',
  vat_rate           numeric(5,2) NOT NULL DEFAULT 20 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  vat_code_id        uuid REFERENCES vat_codes(id),     -- optional link to a VAT code
  saft_code          text,                              -- SAF-T mapping (Module 9 enabler)
  default_account_id uuid,                              -- optional GL revenue account
  is_active          boolean NOT NULL DEFAULT true,     -- soft delete
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, code),
  UNIQUE (tenant_id, company_id, id),                   -- target for the invoice_lines composite FK
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id),
  FOREIGN KEY (tenant_id, company_id, default_account_id) REFERENCES accounts(tenant_id, company_id, id)
);
CREATE INDEX idx_catalog_search ON catalog_items (tenant_id, company_id, lower(description));
CREATE INDEX idx_catalog_active ON catalog_items (tenant_id, company_id, is_active);

GRANT SELECT, INSERT, UPDATE ON catalog_items TO app_user;  -- no DELETE (soft delete via is_active)

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items FORCE  ROW LEVEL SECURITY;
CREATE POLICY catalog_items_isolation ON catalog_items
  USING      (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id())
  WITH CHECK (tenant_id = app.current_tenant_id() AND company_id = app.current_company_id());

-- ---- invoice line ↔ catalog link + snapshot ----------------------------------
-- A composite FK is UNENFORCED when catalog_item_id IS NULL (MATCH SIMPLE), so
-- free-text lines (no catalog selection) remain valid.
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid,
  ADD COLUMN IF NOT EXISTS unit            text,
  ADD COLUMN IF NOT EXISTS saft_code       text;
ALTER TABLE invoice_lines
  ADD CONSTRAINT invoice_lines_catalog_fk
  FOREIGN KEY (tenant_id, company_id, catalog_item_id) REFERENCES catalog_items(tenant_id, company_id, id);
