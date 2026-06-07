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

### 🔴 Critical — BETA BLOCKERS — status update (this program)
1. **DR — backup + restore now implemented; one real drill remains.** `scripts/pg-backup.sh`
   (encrypted, retained, integrity-checked logical backups to SSE-KMS S3) + `scripts/pg-restore-drill.sh`
   (verifies backup→restore→migrations→app_user→RLS→audit-chain→sample data, reports RPO/RTO) are
   authored + documented (`disaster-recovery.md`). **Remaining:** install the cron/timer + run the
   restore drill once on real infra and sign off.
2. **CI lane PROVEN LOCALLY against a real Postgres 16.** Executed this program:
   migrations apply (all 36) ✅ · `migrate:validate` (RLS FORCE on all 51 tenant tables + rollback smoke) ✅ ·
   SAF-T DB e2e (RLS isolation, repository, v2/dataquality migration, stale-processing — 28 tests) ✅ ·
   ledger integrity (5) ✅ · registration (2) ✅ · **core accounting workflow e2e (14/14:** posting,
   unbalanced-reject, invoice issue+numbering, VAT, trial balance, P&L, immutability, AI-cannot-post/approve,
   audit-chain, RLS) ✅ · API+Web typecheck/lint/build ✅ · unit (271) ✅.
   **Remaining (needs GitHub Actions / Redis / gitleaks binary):** the SAF-T **pipeline** e2e
   (`saft-v2-e2e` — boots AppModule which requires `REDIS_URL`, then enqueues to BullMQ → needs a live
   Redis); the dedicated `rls-isolation.e2e-spec` (coupled to a missing bespoke seed harness — RLS is
   already proven by `saft-rls` + the core-loop RLS assertion); and the gitleaks secret-scan job.

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
**GO for a controlled beta** (single firm / low-volume real data, `SAFT_XML_ENABLED=false`), gated on **one operational task**: run `scripts/pg-restore-drill.sh` against a real restored backup and sign off (and install the backup cron). The release-blocking test lane is now **proven against a real Postgres** (migrations + validation + RLS isolation + ledger integrity + registration + the full core accounting workflow, all green); the remaining unproven items (SAF-T *pipeline* e2e + dedicated rls-isolation seed + gitleaks job) need GitHub Actions/Redis and are **not on the beta critical path** — the SAF-T XML feature is flag-OFF for beta and RLS is already proven by other suites.
