# Tenant Context & Row-Level Security — How It Works

## The two-role model (non-negotiable)
- **Owner/migration role** (e.g. `app_owner`): owns tables, runs migrations ONLY. Never used by the running app.
- **`app_user`** (runtime): `LOGIN NOSUPERUSER NOBYPASSRLS`, not an owner → **fully subject to RLS**. The app connects ONLY as this role. (`pg-pool.ts` reads `PGUSER` from the vault; it must be `app_user`.)

## Request flow
```
HTTP request
  └─ TenantContextMiddleware: PrincipalResolver.resolve(req) → { userId, tenantId } FROM SESSION
        (tenantId is NEVER read from body/query/headers)
     → TenantContextService.run({ tenantId, userId })   [AsyncLocalStorage]
  └─ (company-scoped routes) TenancyService.switchCompany / assertCompanyAccess
        → checks an ACTIVE assignment, then ctx.setActiveCompany(companyId)
  └─ Repository call → DatabaseContextService.run(work):
        BEGIN;
        SELECT set_config('app.tenant_id',  <tenantId>, true);   -- SET LOCAL
        SELECT set_config('app.company_id', <companyId|''>, true);
        <queries run on THIS connection, under RLS>
        COMMIT;  (or ROLLBACK on error) → SET LOCAL resets → connection returns clean
```

## Why it cannot leak between requests
Context is applied with `set_config(..., is_local := true)` **inside a transaction**, so it
resets on COMMIT/ROLLBACK and never persists on the pooled connection. Repositories receive a
`ScopedClient` bound to that one transaction’s connection — they cannot run queries outside it.

## Fail-closed
`DatabaseContextService.run` calls `TenantContextService.currentOrThrow()` first. No context →
`MissingTenantContextError` is thrown **before any query**. At the DB layer, an unset
`app.tenant_id` makes `app.current_tenant_id()` return NULL, so every policy predicate is NULL
(never true) → zero rows; INSERT `WITH CHECK` fails. Two independent guarantees.

## Cross-tenant is impossible
- `tenant_id` is derived from the session, never the client.
- RLS `USING` + `WITH CHECK (tenant_id = app.current_tenant_id())` on every tenancy table.
- Composite FKs (`(tenant_id, id)`) structurally prevent children referencing parents in another tenant.
- `app_user` has no BYPASSRLS and is not an owner.

## Company access
`company_id` MAY come from the client (path/header) but is authorized against
`company_assignments` (an ACTIVE assignment for the current user) BEFORE it is set as the active
company. Cross-tenant company ids are invisible under RLS, so the check returns false → 403.

## Background jobs
Job payloads carry `{ tenantId, companyId? }`. Workers call `JobContextRunner.run(holder, work)`
to re-establish ALS context, then use the SAME `DatabaseContextService` path — so jobs are
RLS-scoped exactly like HTTP requests.

## Adding new tenant-scoped tables (later tasks)
Every new tenant-scoped table MUST: have `tenant_id NOT NULL` (and `company_id` if company-scoped),
`ENABLE`+`FORCE ROW LEVEL SECURITY`, and a policy `USING/WITH CHECK (tenant_id = app.current_tenant_id())`
(plus `company_id = app.current_company_id()` where company-scoped). CI guards that no tenant-scoped
table ships without RLS.
