-- =====================================================================
-- 0002 Tenancy core schema.
-- tenant_id/company_id rules:
--   * Every tenant-scoped table has tenant_id uuid NOT NULL.
--   * Composite uniques + composite FKs guarantee children cannot reference
--     a parent in a different tenant (structural cross-tenant prevention).
--   * Indexes lead with tenant_id (+ company_id where relevant).
-- No accounting/business logic here — tenancy structure only.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  placement   text NOT NULL DEFAULT 'shared',  -- 'shared' | 'dedicated'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  email       text NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),          -- enables composite FKs
  UNIQUE (tenant_id, email)
);

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE companies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  organization_id          uuid,
  name                     text NOT NULL,
  eik                      text,                 -- stored only; validation is masterdata's job
  vat_status               text NOT NULL DEFAULT 'none',
  base_currency            text NOT NULL DEFAULT 'EUR',
  fiscal_year_start_month  int  NOT NULL DEFAULT 1,
  status                   text NOT NULL DEFAULT 'active',
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  -- organization (if set) must be in the same tenant:
  FOREIGN KEY (tenant_id, organization_id) REFERENCES organizations(tenant_id, id)
);

CREATE TABLE company_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL,
  company_id  uuid NOT NULL,
  role        text NOT NULL,                     -- coarse role; RBAC detail is Task 005
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, company_id),
  -- user and company must both belong to the SAME tenant as the assignment:
  FOREIGN KEY (tenant_id, user_id)    REFERENCES users(tenant_id, id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)
);

-- Indexes lead with tenant_id (then the common filter).
CREATE INDEX idx_users_tenant               ON users (tenant_id);
CREATE INDEX idx_orgs_tenant                ON organizations (tenant_id);
CREATE INDEX idx_companies_tenant           ON companies (tenant_id);
CREATE INDEX idx_assignments_tenant_user    ON company_assignments (tenant_id, user_id);
CREATE INDEX idx_assignments_tenant_company ON company_assignments (tenant_id, company_id);
