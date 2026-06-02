# TASK 005 — Authentication & Authorization

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 005 · **Depends on:** 003 (RLS), 004 (ledger/audit) · **Type:** security-critical · **PR:** one scoped PR.
**Deliverable:** `task005-auth.zip` → unzip into repo root (adds to `apps/api/`).

> **Verified during build:** migration 0006 applied on a live PostgreSQL 16 and the pre-auth lookup proved correct (cross-tenant lookup works via SECURITY DEFINER while `app_user` still can't read other tenants); the auth logic (argon2id, RFC-6238 TOTP, JWT, RBAC guardrails) ran green in Node; 0006 down→up round-tripped. **Scope held to login + MFA + RBAC + roles** — no KEP signing, no business logic, no OCR, no frontend.

---

## 1. What was implemented
- **Login** (email+password, argon2id), **MFA** (TOTP, RFC 6238), **refresh-token sessions** (opaque token, only its SHA-256 hash stored; rotated on use; revocable), **account lockout** (5 fails → 15-min lock), and **RBAC** (tenant + company roles, static catalog, separation-of-duties guardrails).
- **The pre-auth-under-RLS problem solved:** a `SECURITY DEFINER` function `app.authenticate_lookup` owned by a dedicated **NOLOGIN/BYPASSRLS** role `auth_lookup`; `app_user` may only EXECUTE it and stays `NOBYPASSRLS` with FORCE RLS everywhere.
- **Per-request authz:** `JwtPrincipalResolver` (replaces Task 003's stub) verifies the access JWT and yields `{userId, tenantId}` from the **signed claim**; feeds Task 003's middleware. Global `RbacGuard` + `@RequirePermission(...)` re-authorize on the server.

## 2. Files created (25)
- DB: `db/migrations/0006_auth.{up,down}.sql`.
- identity domain: `domain/roles.ts` (catalog + guardrails), `domain/errors.ts`.
- application: `auth.service.interface.ts`, `auth.service.ts`, `rbac.service.ts`, `index.ts`.
- infrastructure: `password.hasher.ts` (argon2id), `totp.service.ts` (RFC 6238, dep-free), `token.service.ts` (JWT + refresh), `user-auth.repository.ts`, `session.repository.ts`, `jwt-principal-resolver.ts`.
- api: `auth.controller.ts`, `dto/auth.dto.ts`, `rbac.guard.ts`, `require-permission.decorator.ts`.
- module/index: `identity.module.ts`, `index.ts`.
- tests/docs: `test/auth/{auth-logic.spec.ts, verify-auth.sh, README.md}`, `docs/AUTH.md`.

## 3. Files modified
- `platform/database/database-context.service.ts` — added the tightly-scoped `runWithoutTenant` path used ONLY by the pre-auth lookup.
- `modules/identity/*` — replaced Task 003's minimal `SessionPrincipalResolver` provider with `JwtPrincipalResolver`; expanded the module.

## 4. Tests executed
- **Node logic proof (ran, all passed):** argon2id verify/reject + `$argon2id$` format; TOTP accept/reject; JWT round-trip + tamper/wrong-key rejection; RBAC — accountant can post but **not** submit VAT, approver can submit VAT but **not** post, tenant_admin can manage users, viewer read-only.
- **DB-layer proof (ran, all passed):** cross-tenant pre-auth lookup returns the row; direct cross-tenant `SELECT users` returns 0; `app_user` bypassrls=false / `auth_lookup` bypassrls=true,login=false; RLS forced on `memberships` + `auth_sessions`.
- Shipped as `auth-logic.spec.ts` (Jest) + `verify-auth.sh`.

## 5. Security checks
- `app_user` remains NOBYPASSRLS; only the minimal pre-auth lookup is RLS-exempt (separate NOLOGIN role).
- tenantId derived from the signed JWT, never client input; refresh tokens stored hashed + rotated + revocable; lockout + uniform-failure/constant-work timing mitigation; JWT secret from the vault.
- Server re-authorizes every protected route (UI hints untrusted, Invariant 9); hard guardrails enforce separation of duties; MFA secret flagged for KMS-at-rest.

## 6. Screenshots / UI preview
Backend task — no UI (the login screen is part of the App Shell, a later frontend task). API preview:
```
POST /auth/login        {email,password}  -> {status:'authenticated',accessToken,refreshToken}
                                           or {status:'mfa_required', mfaToken}
POST /auth/mfa/verify   {mfaToken,code}    -> {status:'authenticated',accessToken,refreshToken}
POST /auth/refresh      {refreshToken}     -> rotated {accessToken,refreshToken}
POST /auth/logout       {refreshToken}     -> 204
Authorization: Bearer <accessToken>  on all tenant-scoped routes.
```

## 7. Known limitations
- KEP step-up for state submission is modeled (guardrail) but not implemented (later task).
- MFA secret encryption-at-rest (KMS) is a marked TODO; stored plaintext column for now.
- HS256 JWT for MVP (vault secret); RS256 + JWKS recommended for production rotation.
- Registration/password-reset/email flows are out of scope for 005 (users seeded/provisioned).
- The Jest/e2e suite ran in spec form for the framework-bound parts; the pure logic + DB layer were executed and verified here.

## 8. Next task recommendation
**Task 006 — Master Data** (companies, counterparties, chart of accounts, VAT codes): builds on tenancy + RBAC; the chart of accounts replaces the minimal `accounts` table from Task 004 (masterdata becomes its owner), and counterparty/EIK/VIES validation lands here. Endpoints will use `@RequirePermission` from this task.

---
*Production-ready code + migration + tests + verification scripts + README. Verified on PostgreSQL 16 + Node. Commit: `feat(identity): authentication, MFA, and RBAC (security-critical)`.*
