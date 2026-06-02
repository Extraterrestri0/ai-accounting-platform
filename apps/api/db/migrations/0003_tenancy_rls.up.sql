-- =====================================================================
-- 0003 Row-Level Security: helper functions, policies, grants.
-- FAIL-CLOSED: if app.tenant_id is unset/empty, current_tenant_id() = NULL,
-- so `tenant_id = NULL` is NULL (never true) -> zero rows; INSERT WITH CHECK
-- fails. No tenant context => no access.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS app;

-- NULLIF('','') -> NULL handles "set but empty"; missing setting -> NULL too.
CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_company_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid;
$$;

-- ---- Grants for the runtime role (app_user) -------------------------
GRANT USAGE ON SCHEMA app TO app_user;
GRANT EXECUTE ON FUNCTION app.current_tenant_id() TO app_user;
GRANT EXECUTE ON FUNCTION app.current_company_id() TO app_user;

GRANT SELECT ON tenants, users, organizations TO app_user;
GRANT SELECT, INSERT, UPDATE ON companies            TO app_user;
GRANT SELECT, INSERT, UPDATE ON company_assignments  TO app_user;
-- No DELETE granted: lifecycle is via status (soft archive), not row deletion.

-- ---- Enable + FORCE RLS on every tenant-scoped table ----------------
-- FORCE makes even the table owner subject to RLS (defense in depth).
-- The owner role is used ONLY for migrations; the app connects as app_user.
ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants             FORCE  ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               FORCE  ROW LEVEL SECURITY;
ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations       FORCE  ROW LEVEL SECURITY;
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies           FORCE  ROW LEVEL SECURITY;
ALTER TABLE company_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_assignments FORCE  ROW LEVEL SECURITY;

-- ---- Policies -------------------------------------------------------
-- tenants: a session may see ONLY its own tenant row.
CREATE POLICY tenants_isolation ON tenants
  USING (id = app.current_tenant_id());

-- tenant-scoped tables: rows must match the current tenant for read AND write.
CREATE POLICY users_isolation ON users
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY organizations_isolation ON organizations
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY companies_isolation ON companies
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY company_assignments_isolation ON company_assignments
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

-- ---- Auto-grant + force RLS on FUTURE tables (defense for later tasks)
-- Replace <OWNER> with the migration/owner role at deploy time.
-- ALTER DEFAULT PRIVILEGES FOR ROLE <OWNER> IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;
-- NOTE: later tasks must ENABLE/FORCE RLS + add a tenant (and company) policy
-- on every new tenant-scoped table. CI guards this (see test 'all tenant tables have RLS').
