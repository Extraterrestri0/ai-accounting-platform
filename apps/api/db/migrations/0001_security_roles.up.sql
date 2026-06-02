-- =====================================================================
-- 0001 Security roles (run as a superuser/admin during provisioning).
-- The application connects as app_user, which is SUBJECT to RLS:
--   * NOT a superuser
--   * NOT the owner of any table
--   * NOBYPASSRLS  (can never bypass row-level security)
-- A separate owner/migration role (here: current role running migrations)
-- owns the objects and is used ONLY for migrations — never by the running app.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    -- Password is set out-of-band from the secrets vault (never in code/migrations).
    CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END$$;
