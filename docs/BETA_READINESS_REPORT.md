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
1. **DR — backup + restore drill EXECUTED + signed off (2026-06-08). ✅ CLEARED for beta.**
   `scripts/pg-backup.sh` + `scripts/pg-restore-drill.sh` (encrypted, retained, integrity-checked SSE-KMS
   S3 backups + cloud restore drill) are authored + documented. The drill was **run end-to-end** via the
   **local-equivalent** path (`scripts/pg-restore-drill.local.sh`, for the no-AWS environment): real
   `pg_dump -Fc -Z6` → integrity (`pg_restore --list`) → sha256 manifest → restore into a **clean DB** →
   **all 11 soundness checks GREEN** (restored+queryable · migrations consistent 34=34 · `app_user` ·
   RLS forced, 0 unprotected · audit chain valid, 2 tenants 0 broken · company+accounting readable ·
   ledger balanced · period locks intact · payments+banking readable · SAF-T readable), source↔restored
   counts matching exactly. RPO proxy 0 m, RTO proxy 1 s. Evidence + sign-off:
   `docs/runbooks/disaster-recovery.md` (sign-off log) + `docs/runbooks/evidence/restore-drill-2026-06-08.*`.
   **Remaining for public launch (not a beta blocker):** install the backup cron/timer on the host and run
   the **cloud** drill once with AWS creds to additionally prove SSE-KMS upload + S3 Object-Lock retention
   and re-measure production-scale RTO.
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
**GO for a controlled beta** (single firm / low-volume real data, `SAFT_XML_ENABLED=false`). The final gating
operational task — **prove backup + restore against a real restored backup and sign off** — is now **DONE**
(2026-06-08): a real `pg_dump` was taken, checksummed, restored into a clean database, and all 11 soundness
invariants verified green with source↔restored parity (see blocker #1 + `disaster-recovery.md` sign-off log).
The release-blocking test lane is **proven against a real Postgres** (migrations + validation + RLS isolation +
ledger integrity + registration + the full core accounting workflow, all green).

**Remaining items are public-launch blockers, not beta blockers:** (a) run the **cloud** drill with AWS creds to
prove SSE-KMS upload + S3 Object-Lock retention and re-measure production-scale RTO, and install the backup
cron/timer; (b) the SAF-T *pipeline* e2e + dedicated rls-isolation seed + gitleaks job (need GitHub
Actions/Redis — SAF-T XML is flag-OFF for beta and RLS is already proven by other suites); (c) the 🟠/🟡 launch
items above (egress restriction, OCR vendor, auth/permission test matrices, tracing, log redaction platform-wide).

**Controlled Beta is now ALLOWED.**

## Controlled Beta launch documentation
The beta launch is planned in `docs/beta/` + `docs/runbooks/` (no business/AI/SAF-T changes — process docs only):
1. **Controlled Beta Launch Plan** — [`beta/CONTROLLED_BETA_LAUNCH_PLAN.md`](beta/CONTROLLED_BETA_LAUNCH_PLAN.md) (scope + entry criteria).
2. **Beta Operations Runbook** — [`runbooks/beta-operations.md`](runbooks/beta-operations.md).
3. **Beta Risk Register** — [`beta/BETA_RISK_REGISTER.md`](beta/BETA_RISK_REGISTER.md).
4. **Beta Exit Criteria** — [`beta/BETA_EXIT_CRITERIA.md`](beta/BETA_EXIT_CRITERIA.md).
5. **First 30 Days Monitoring Plan** — [`runbooks/beta-first-30-days-monitoring.md`](runbooks/beta-first-30-days-monitoring.md).

**Two open entry gates before the first invite (no code):** install the backup cron (`pg-backup.sh`) and assign a named beta support owner.
