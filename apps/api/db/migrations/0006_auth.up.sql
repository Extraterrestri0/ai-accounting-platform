-- =====================================================================
-- 0006 Authentication & Authorization.
-- Adds credential/MFA/lockout columns to users; tenant-level memberships;
-- refresh-token sessions; and a pre-auth email lookup that works under RLS.
--
-- PRE-AUTH LOOKUP PROBLEM: login must find a user by email BEFORE any tenant
-- context exists, but every tenant table is RLS+FORCE protected. Solution:
-- a SECURITY DEFINER function owned by a dedicated NOLOGIN/BYPASSRLS role
-- `auth_lookup`. app_user may only EXECUTE it (not read users cross-tenant).
-- app_user stays NOBYPASSRLS; FORCE RLS remains on every table.
-- =====================================================================

-- ---- credential / MFA / lockout columns on users ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash         text,
  ADD COLUMN IF NOT EXISTS password_algo         text NOT NULL DEFAULT 'argon2id',
  ADD COLUMN IF NOT EXISTS mfa_enabled           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret            text,        -- encrypt at rest via KMS (app layer)
  ADD COLUMN IF NOT EXISTS failed_login_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at         timestamptz;

-- column-level UPDATE grant (least privilege: cannot change id/tenant_id/email)
GRANT UPDATE (password_hash, password_algo, mfa_enabled, mfa_secret,
              failed_login_attempts, locked_until, last_login_at, status)
  ON users TO app_user;

-- ---- tenant-level membership (RBAC at the tenant scope) ----
CREATE TABLE memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  user_id    uuid NOT NULL,
  role       text NOT NULL,                 -- 'tenant_admin' | 'member'
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

-- ---- refresh-token sessions (access tokens are stateless JWTs) ----
CREATE TABLE auth_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  user_id            uuid NOT NULL,
  refresh_token_hash text NOT NULL,         -- only the HASH of the refresh token is stored
  issued_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  user_agent         text,
  ip                 text,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);
CREATE INDEX idx_sessions_user ON auth_sessions (tenant_id, user_id);

GRANT SELECT, INSERT, UPDATE ON memberships   TO app_user;
GRANT SELECT, INSERT, UPDATE ON auth_sessions TO app_user;  -- UPDATE only to set revoked_at

-- ---- RLS on the new tenant-scoped tables ----
ALTER TABLE memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships   FORCE  ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE  ROW LEVEL SECURITY;
CREATE POLICY memberships_isolation ON memberships
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY auth_sessions_isolation ON auth_sessions
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());

-- ---- pre-auth lookup: SECURITY DEFINER owned by a NOLOGIN BYPASSRLS role ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auth_lookup') THEN
    CREATE ROLE auth_lookup NOLOGIN NOBYPASSRLS;  -- BYPASSRLS set below (needs superuser)
  END IF;
END$$;
ALTER ROLE auth_lookup BYPASSRLS;
GRANT USAGE ON SCHEMA public TO auth_lookup;
GRANT SELECT ON users TO auth_lookup;  -- owner of the SECURITY DEFINER fn needs table SELECT

CREATE OR REPLACE FUNCTION app.authenticate_lookup(p_email text)
RETURNS TABLE (
  id uuid, tenant_id uuid, password_hash text, password_algo text,
  mfa_enabled boolean, mfa_secret text, status text,
  locked_until timestamptz, failed_login_attempts int
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, app AS $$
  SELECT id, tenant_id, password_hash, password_algo, mfa_enabled, mfa_secret,
         status, locked_until, failed_login_attempts
  FROM users
  WHERE lower(email) = lower(p_email);
$$;
ALTER FUNCTION app.authenticate_lookup(text) OWNER TO auth_lookup;  -- runs with BYPASSRLS
REVOKE ALL ON FUNCTION app.authenticate_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.authenticate_lookup(text) TO app_user;
