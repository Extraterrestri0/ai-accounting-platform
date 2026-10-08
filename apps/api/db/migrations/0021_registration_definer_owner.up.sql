-- =====================================================================
-- 0021 Fix ownership of the self-service signup SECURITY DEFINER functions.
--
-- register_account / oauth_account (added in 0016) run WITHOUT tenant context
-- (signup happens before any tenant/membership exists), so their INSERTs must
-- not be blocked by the FORCE-RLS policies. 0016 left them `OWNER TO CURRENT_USER`,
-- i.e. owned by the cluster SUPERUSER that runs migrations. That is wrong for two
-- reasons:
--   1. A SECURITY DEFINER function owned by a superuser executes with FULL
--      superuser rights — far more than the signup path needs (least-privilege
--      violation, CLAUDE.md §7/§11). It only "works" because that owner happens
--      to bypass RLS.
--   2. It couples correctness to *who ran the migration*. Owned by a non-BYPASSRLS
--      role, the very first INSERT fails: "new row violates row-level security
--      policy for table tenants" — registration breaks and no membership is created.
--
-- The established, audited pattern (see 0006 `authenticate_lookup`) is to own these
-- bypass functions with the dedicated `auth_lookup` role: NOLOGIN + BYPASSRLS, never
-- used on the app path. app_user keeps ONLY EXECUTE; FORCE RLS stays on every table
-- — tenancy isolation is unchanged.
-- =====================================================================

-- auth_lookup becomes the function OWNER, so it needs table privileges directly:
-- BYPASSRLS bypasses RLS *policies*, NOT grant-based privilege checks. SELECT is
-- required for the duplicate-email check and the INSERT ... RETURNING reads.
-- (SELECT on users was already granted in 0006; re-granting is a harmless no-op.)
GRANT SELECT, INSERT ON tenants, users, memberships, companies, company_assignments TO auth_lookup;

ALTER FUNCTION app.register_account(text, text, text) OWNER TO auth_lookup;
ALTER FUNCTION app.oauth_account(text, text)          OWNER TO auth_lookup;
