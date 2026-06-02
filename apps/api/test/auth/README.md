# Auth Tests

- `auth-logic.spec.ts` — Jest: argon2id, RFC-6238 TOTP, JWT, RBAC guardrails (verified passing).
- `verify-auth.sh` — DB proof: the SECURITY DEFINER pre-auth lookup works cross-tenant while
  `app_user` (NOBYPASSRLS) cannot read other tenants directly.

## Run
- Logic: `pnpm --filter @app/api test:auth`
- DB: apply 0001→0006, seed a user per tenant, then
  `PSQL_APP="psql -U app_user -d acct" ./verify-auth.sh`
