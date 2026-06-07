# Beta Readiness Report

Date: 2026-06-08 · Branch: `feat/mvp-modules` · Scope: reliability/security/observability/DR/CI/testing only (no business features).

## Phase 6 — Security findings (verified in code)

| Area | Finding | Verdict |
|---|---|---|
| **JWT storage** | Refresh token = **HttpOnly + Secure + SameSite cookie** with **rotation** (`auth.controller` `setRefreshCookie` on login/register/mfa/refresh; `secure-cookie.ts`). Only the **short-lived access token** is in `localStorage` + sent as `Authorization: Bearer` (`web/lib/api/client.ts`). | **Acceptable for beta; harden for launch.** Access-token-in-localStorage is XSS-exposable but short-lived; refresh is properly cookied + revocable. Pre-launch: consider moving the access token out of `localStorage` (in-memory only) or a BFF cookie. |
| **Authentication flow** | email+password (argon2id), MFA challenge (`/auth/mfa/verify`), Google OAuth (start/callback) with refresh-cookie issuance. | **OK; needs an automated negative-path test matrix.** |
| **MFA** | `verifyMfa(mfaToken, code)` flow present; lockout columns exist on `users`. | **Present; lifecycle/lockout not covered by automated tests.** |
| **Session lifecycle** | `auth_sessions` stores **hashed** refresh tokens with `expires_at` + `revoked_at`; `findActiveByHash` enforces `revoked_at IS NULL AND expires_at > now()`; refresh **rotates** + re-issues; `revoke()` on logout. | **Strong.** |
| **Authorization** | Global `RbacGuard` (`APP_GUARD`) re-authorizes every `@RequirePermission` against effective tenant+company permissions; RBAC+ABAC role map; hard guardrails (e.g. VAT_SUBMIT). UI permissions are hints only; backend re-authorizes. | **Strong; add a CI permission-matrix (allow/deny per role).** |
| **RLS enforcement** | `ENABLE`+`FORCE` RLS + tenant/company policy on **all ~47 tenant tables**; non-bypass `app_user`; `SECURITY DEFINER` only for pre-auth lookup + registration (correctly owned, 0021). `migrate:validate` now asserts FORCE-RLS coverage in CI. | **Strong; proof now wired into CI.** |
| **Secrets** | AWS Secrets Manager injects PGPASSWORD/JWT_SECRET/GOOGLE_CLIENT_SECRET/MIGRATION_PASSWORD into ECS via `valueFrom`; KMS-encrypted. **CI secret scanning added** (gitleaks). | **OK; add rotation + scheduled audit-chain verify.** |
| **Network egress** | App/worker SGs allow egress `0.0.0.0/0`. | **High (launch):** restrict to approved EU endpoints (§7/§11). |

**Security verdict:** no *critical* code vulnerability found; auth/session/RLS/audit design is sound. Beta-acceptable; the launch-hardening items (egress, access-token storage, rotation, scheduled audit-verify, tracing, permission/auth test matrices) are tracked below.

## Phase 7 — Launch readiness (classified)

### 🔴 Critical — BETA BLOCKERS (must fix before beta with real data)
1. **DR unproven** — perform a **DB restore drill** (RPO/RTO measured) and, for the EC2 (RLS-correct) path, **configure automated backups + PITR** (`docs/runbooks/disaster-recovery.md`). Backups are configured for RDS but the runtime path lacks them.
2. **CI must go green on the new release-blocking lane** — the rewritten pipeline now provisions Postgres/Redis, applies migrations, validates them, and runs RLS/ledger/core-loop/SAF-T e2e with `CI_REQUIRE_DB=1`. This must be **observed green once** (it has not yet run in any environment).

### 🟠 High — LAUNCH BLOCKERS (before public launch)
3. Platform-wide **structured + PII-redacted logging with correlation IDs** (only SAF-T is covered today).
4. **Metrics scraper + dashboards** and **ALB/ECS/app/queue/audit-verify alarms** (RDS+Redis alarms added; rest documented).
5. **Restrict egress** to approved EU endpoints.
6. **OCR vendor** integrated + accuracy-evaluated (extraction is the loop's input; default is a stub).
7. **Auth/permission test matrices** (MFA, session rotation, lockout, RBAC allow/deny) in CI.
8. **§15 governance ADR** for credit/debit notes, proforma, SAF-T (built outside MVP scope).
9. Access-token storage hardening; **secret rotation**; **scheduled audit-chain verification** + alert.

### 🟡 Medium
10. Distributed **tracing** (OpenTelemetry).
11. **Load/scale tests**; SAF-T `dataset_json` materialization for large tenants.
12. **Frontend test harness** (RTL/Playwright) for the core loop + permission rendering.
13. Build **real Docker images** in CI (currently `docker compose config` only).
14. Document/automate the **weekly backup-freshness** check.

### 🟢 Low / post-launch
15. Cross-region DR (likely precluded by EU residency).
16. SAF-T `SAFT_XML_ENABLED` enablement (after e2e-green + Object-Lock bucket + NRA XSD/values — Object-Lock bucket is already in Terraform).
17. Learning engine / AI features (post-MVP per §15).

## Beta go/no-go
**Conditional GO for a controlled beta** (single firm / low-volume real data, SAF-T flag OFF) **once the two Critical items are cleared**: (1) a proven DB restore + EC2 backups, and (2) the new CI lane observed green. Everything else is launch-hardening. The core trustworthy loop, RLS, audit, and period locking are implemented and — with the CI changes in this program — about to be *proven*, not just asserted.
