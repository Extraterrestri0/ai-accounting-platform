-- Revert 0021: hand ownership of the signup functions back to the migrating role
-- and drop the extra table grants added for auth_lookup. SELECT on `users` is left
-- in place because that grant predates this migration (created in 0006).
ALTER FUNCTION app.register_account(text, text, text) OWNER TO CURRENT_USER;
ALTER FUNCTION app.oauth_account(text, text)          OWNER TO CURRENT_USER;

REVOKE INSERT ON tenants, users, memberships, companies, company_assignments FROM auth_lookup;
REVOKE SELECT ON tenants, memberships, companies, company_assignments        FROM auth_lookup;
