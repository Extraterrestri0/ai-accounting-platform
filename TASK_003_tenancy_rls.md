# TASK 003 — Multi-Tenancy Foundation with PostgreSQL RLS

**Type:** SECURITY-CRITICAL · **Maps to:** Build Order step 3 (`CLAUDE.md` §14) · **Depends on:** Task 001/002 · **PR:** one scoped PR.
**Deliverable:** `task003-tenancy-rls.zip` → unzip into repo root (populates `apps/api/`).

> **Verified against a live PostgreSQL 16** during build: migrations applied, the SQL proof passed all checks, and a down→up round-trip re-passed. Output is production-ready code + migrations + tests + READMEs. **No ledger, no full auth, no accounting logic, no OCR, no frontend (except the company-switch API contract).**

---

## 0. Acceptance criteria — status

| Criterion | Status |
|-----------|--------|
| User A cannot **read** tenant B | ✅ proved (SQL T2/T3, Jest) |
| User A cannot **write** tenant B | ✅ proved (SQL T4/T5 — `WITH CHECK` + 0-row update) |
| **Forged tenant_id** rejected | ✅ tenant from session only; RLS `WITH CHECK` blocks forged inserts |
| **Missing context fails closed** | ✅ `MissingTenantContextError` before any query; NULL policy predicate → 0 rows |
| Company switch only for **assigned** companies | ✅ assignment check; cross-tenant company invisible → 403 |
| **RLS active in tests** | ✅ proof + Jest assert `relrowsecurity` on all tables |
| app DB role **cannot bypass RLS** | ✅ `app_user` `NOBYPASSRLS`, non-owner, FORCE RLS |
| Context **cannot leak between requests** | ✅ transaction-local `SET LOCAL`; proved by T0 + Jest leak test |
| Task 004 can build the immutable ledger on top | ✅ context + RLS pattern + `company_id` plumbing ready |

**Live verification output:** `ALL RLS ISOLATION CHECKS PASSED` (PostgreSQL 16.14), before and after a migration down/up round-trip.

---

## 1. What was built

### Database (`apps/api/db/migrations/`)
- **0001 security roles** — `app_user` as `LOGIN NOSUPERUSER NOBYPASSRLS` (runtime role, subject to RLS); owner/migration role is separate and used only for migrations.
- **0002 tenancy core** — `tenants, users, organizations, companies, company_assignments`; `tenant_id NOT NULL` everywhere; **composite uniques `(tenant_id, id)` + composite FKs** so a child can never reference a parent in another tenant; indexes lead with `tenant_id`.
- **0003 RLS** — `app.current_tenant_id()` / `app.current_company_id()` helpers (`NULLIF`→NULL = fail-closed), least-privilege grants to `app_user` (no DELETE), **ENABLE + FORCE RLS** on every table, and `USING`/`WITH CHECK (tenant_id = app.current_tenant_id())` policies. Down migrations included.

### Backend — platform (cross-cutting)
- `tenant-context/` — `TenantContextService` (AsyncLocalStorage), mutable `TenantContextHolder`, `PrincipalResolver` port, `TenantContextMiddleware` (derives tenant from the **session**, never client input), `MissingTenantContextError`.
- `database/` — `pg-pool` (connects as `app_user`), `ScopedClient` (bound to one transaction's connection), **`DatabaseContextService`** (BEGIN → `set_config(..., true)` = SET LOCAL → work → COMMIT/ROLLBACK; fail-closed via `currentOrThrow()`), `JobContextRunner` (re-applies context for workers), global `DatabaseModule`.

### Backend — tenancy module
- `domain/` models + `CompanyNotAssignedError`.
- `application/` `ITenancyService` (+ `TENANCY_SERVICE` token) and impl: `createCompany` (tenant from session, auto-assigns creator), `listMyCompanies`, `assertCompanyAccess`, `switchCompany`.
- `infrastructure/` `CompanyRepository`, `CompanyAssignmentRepository` — all DB access via `DatabaseContextService` (RLS-backed); repositories never accept a `tenant_id` from callers.
- `api/` controller: `POST /companies`, `GET /companies`, `POST /companies/:id/switch` + DTOs (**no `tenantId` field anywhere**).

### Backend — identity (minimum only)
- `SessionPrincipalResolver` reads the server-verified principal off the request; provides `PRINCIPAL_RESOLVER`. (Full auth = Task 005.)

### Wiring
- `AppModule` imports the global `DatabaseModule` and applies `TenantContextMiddleware` to all routes.

### Tests & docs
- `test/rls-isolation/rls_proof.sql` — fast SQL proof (verified passing).
- `test/rls-isolation/rls-isolation.e2e-spec.ts` — Jest + `pg` suite exercising the production `DatabaseContextService` for all six scenarios + the leak test.
- `apps/api/docs/TENANCY_RLS.md` — how tenant context works (two-role model, request flow, fail-closed, jobs, adding new tables).

---

## 2. Security properties (how each requirement is met)

- **app role cannot bypass RLS:** `app_user` is `NOBYPASSRLS`, never an owner; tables use `FORCE ROW LEVEL SECURITY` (owner subject too).
- **No cross-tenant access:** RLS `USING`/`WITH CHECK` on every table + composite FKs + tenant-from-session.
- **No client-provided tenant_id trusted:** tenant derives from `PrincipalResolver` (session); DTOs have no `tenantId`; repositories pass the session tenant; RLS `WITH CHECK` is the backstop.
- **Every request resolves context from the session:** `TenantContextMiddleware` on all routes.
- **Jobs carry + re-apply context:** `JobContextRunner` + the same `DatabaseContextService`.
- **Fail-closed:** `currentOrThrow()` (app layer) **and** NULL policy predicate / failed `WITH CHECK` (DB layer).
- **No leak between requests:** transaction-local `SET LOCAL`, reset on commit; `ScopedClient` confines queries to that transaction.

---

## 3. Verify locally / in CI

1. Start Postgres; create owner + `app_user` (NOBYPASSRLS).
2. Apply `0001→0003` as owner.
3. Seed two tenants (owner) and run `psql -v ON_ERROR_STOP=1 -f rls_proof.sql` → `ALL RLS ISOLATION CHECKS PASSED`.
4. `PGUSER=app_user pnpm --filter @app/api test:rls` → Jest suite green.
5. CI wires this as a **release-blocking** stage (`scripts/test-rls`).

*(`pg` + `@nestjs/*` deps are added by their slices per Task 001's deferred-dependency rule; the code targets those packages.)*

---

## 4. PR & Handoff

- **One PR**, Conventional Commit: `feat(tenancy): multi-tenant foundation with PostgreSQL RLS (security-critical)`.
- CODEOWNERS review required (touches `rls-*`, security-critical).
- **Next:** **Task 004 — Immutable Ledger + Append-only Audit**, built on this foundation: new tenant- **and company**-scoped tables reuse the same context plumbing and MUST `ENABLE/FORCE RLS` + add `tenant_id = app.current_tenant_id()` (and `company_id = app.current_company_id()`) policies; the posting service runs inside `DatabaseContextService` transactions; corrections are reversing entries; audit rows are append-only.

*Production-ready code + migrations + tests + READMEs. Verified against PostgreSQL 16. No ledger, no full auth, no accounting logic, no OCR, no frontend beyond the company-switch API contract.*
