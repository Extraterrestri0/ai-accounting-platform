# RLS Isolation Tests (release-blocking)

These prove tenant isolation against a REAL Postgres with RLS active and the app
connected as the **RLS-subject** role `app_user` (never owner, never BYPASSRLS).

## What runs
- `rls_proof.sql` — fast SQL-level proof (no Node). Run as the owner after migrations.
  Verified passing on PostgreSQL 16.
- `rls-isolation.e2e-spec.ts` — Jest + `pg` suite exercising the production
  `DatabaseContextService` (transaction + `SET LOCAL` + RLS) for all six scenarios.

## How to run (CI / local)
1. Start a test Postgres; create role `app_owner` (owner) and `app_user` (LOGIN NOBYPASSRLS).
2. Apply migrations 0001→0003 as the owner.
3. Seed two tenants (owner): see `scripts/test-rls` (uses the seed block of `rls_proof.sql`).
4. `psql -v ON_ERROR_STOP=1 -f rls_proof.sql`  → expect "ALL RLS ISOLATION CHECKS PASSED".
5. `PGUSER=app_user pnpm --filter @app/api test:rls`  → Jest suite green.

A failure here BLOCKS release. Cross-tenant access is a sev-1.
