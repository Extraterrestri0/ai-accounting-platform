# PROJECT_STATUS.md

**Project:** AI Accounting Platform (Bulgarian-first) · **Updated:** 2026-06-02
**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` · **Sources of truth:** `AI_ACCOUNTING_PLATFORM_MASTER_v1.md`, `CLAUDE.md`, `MONOREPO_STRUCTURE.md`

---

## Current Project State

Foundations through authentication are built and verified. The backend compiles cleanly as a cumulative repo (`tsc` + `eslint` clean), the auth logic tests pass, and every security/accounting-critical layer has been proven against a live PostgreSQL 16. No frontend or workers yet (per roadmap order).

---

## Completed

| Task | Title | Deliverable |
|------|-------|-------------|
| 001 | Repository Bootstrap | folder/package/dependency/workspace plans |
| 002 | Modular Monolith Skeleton | 10 bounded contexts, public interfaces, event contracts, ESLint boundaries |
| 003 | Multi-Tenancy + PostgreSQL RLS | tenants/orgs/companies/assignments, RLS, `SET LOCAL` context, fail-closed |
| 004 | Immutable Ledger + Append-Only Audit | double-entry, reversals-only, immutability triggers, hash-chained audit |
| 005 | Authentication & Authorization | login, MFA (TOTP), RBAC, refresh sessions, JWT principal resolver |

Build-order progress: **5 / 18 tasks complete.**

---

## Verified (with evidence)

| Area | What was proven | How |
|------|-----------------|-----|
| **RLS** | No cross-tenant read/write; forged `tenant_id` rejected; missing context fails closed; transaction-local context does not leak | SQL proof on live PostgreSQL 16 (`rls_proof.sql`) + down/up round-trip |
| **Ledger** | Balanced posts commit; unbalanced rejected (deferred check); UPDATE/DELETE blocked; reversal mirrors original; one reversal per original | Live PG proof (`verify.sh`) + Jest spec |
| **Audit** | Append-only; hash chain validates; tampering detected (corrupted row → chain false) | Live PG proof |
| **Auth** | argon2id verify/reject; RFC-6238 TOTP; JWT round-trip + tamper rejection; RBAC separation-of-duties; pre-auth lookup works cross-tenant while `app_user` stays isolated; MFA secret read is tenant-scoped | Node logic proof + live PG DB proof |
| **Compile gate** | `tsc --noEmit` clean across cumulative `apps/api`; `eslint` clean; auth tests 4/4 pass | Real deps installed (@nestjs 10, pg, argon2, jsonwebtoken) |

Migrations **0001→0006** apply in order and round-trip (down/up) on PostgreSQL 16.

---

## Next Task

**Task 006 — Master Data**: companies, counterparties, chart of accounts, VAT codes.
- Takes ownership of the **minimal `accounts` table** introduced in Task 004 (chart of accounts becomes masterdata's aggregate).
- Adds counterparty management with **EIK checksum + VIES** validation (deterministic validators).
- Adds the **Bulgarian VAT code set** (standard 20 / reduced 9 / zero / exempt / reverse-charge / intra-EU).
- Endpoints guard with `@RequirePermission(...)` from Task 005; all tables tenant/company-scoped with ENABLE+FORCE RLS per the established pattern.

---

## Known Issues

- **Task zips are not standalone.** Each `taskNNN-*.zip` depends on prior tasks; they must be applied in roadmap order (`002 → 003 → 004 → 005`), later files winning. No single zip compiles alone.
- **`refresh` requires a still-valid access token** (sliding-session model — it runs under tenant context). Refreshing a fully-expired token would need a separate bypass session-lookup + migration (deferred; not a bug).
- **MFA secret stored plaintext** in `users.mfa_secret`; encryption-at-rest via KMS is a marked TODO (app layer).
- **KEP step-up** for state submission is modeled in the RBAC guardrails but not implemented (later task).
- **JWT uses HS256** (vault secret) for MVP; RS256 + JWKS recommended for production key rotation.
- **`ALTER ROLE auth_lookup BYPASSRLS`** (migration 0006) requires a superuser migration runner — operational note for deploy.
- **Framework-bound e2e tests** (full Nest HTTP flows) were validated in spec form; the pure logic, DB layer, and RLS/ledger/audit policies were executed against live PG. End-to-end HTTP wiring is exercised in Task 017.
- **Registration / password-reset / email** flows are not yet implemented (out of scope for 005).
- **No frontend (`apps/web`) or Python workers** yet (later roadmap tasks).

---

## Open Decisions

- **Persistence layer:** currently raw `pg` with a `ScopedClient` unit-of-work (chosen for explicit RLS connection discipline). Decide whether/when to adopt an ORM/query builder on top — must preserve the `SET LOCAL` + scoped-client guarantees.
- **Migration runner:** raw SQL files now (runner-agnostic, reviewable). Pick a runner (e.g. node-pg-migrate / Flyway) when CI is built (Task 016).
- **JWT algorithm for prod:** HS256 vs RS256/JWKS (key rotation, multi-service verification).
- **Refresh-token model:** keep sliding-session (valid access token required) vs add full pre-auth refresh via a bypass session-lookup.
- **Audit RLS scope:** currently tenant-scoped (matches requirement); revisit whether company-level audit needs company-scoped RLS.
- **OCR/Document-AI vendor:** EU + zero-retention vendor to be selected and accuracy-validated before Task 008.
- **Cumulative packaging:** whether to maintain a single `repo.zip` (verified cumulative state) alongside per-task zips to simplify application.

---

## Repository Status

- **Monorepo** (pnpm workspaces + Turborepo) structure defined; `apps/api` (NestJS modular monolith) is the only app populated so far.
- **`apps/api` compiles** (`tsc --noEmit` clean), **lints clean** (identity + platform), **auth tests pass (4/4)**.
- **Database:** migrations `0001–0006` present and verified on PostgreSQL 16; two roles — `app_user` (runtime, NOBYPASSRLS) and `auth_lookup` (NOLOGIN/BYPASSRLS, owns only the pre-auth lookup function).
- **Bounded contexts:** identity, tenancy, ledger, audit are implemented; masterdata, docintel, tax, invoicing, reporting, notification exist as skeletons (public interfaces + event contracts only).
- **Dependencies:** added per-slice (deferred-dependency strategy from Task 001); current backend deps proven installable (@nestjs 10, pg, argon2, jsonwebtoken).
- **Not yet present:** `apps/web` (Next.js frontend), `apps/workers` (Python AI/OCR), `infra/` Terraform, CI pipelines.
- **Two fixes applied during Task 005 review:** `token.service.ts` (`jwt.SignOptions` typing) and `app.module.ts` (excluded `auth/login` + `auth/mfa/verify` from the tenant-context middleware so login is reachable).

---

## Invariant Compliance (the 10)

Honored so far: tenant isolation (RLS) ✓ · immutable ledger ✓ · append-only audit ✓ · capability-limited identities (AI/workers can't post — enforced once workers land) ◐ · human-in-the-loop ◐ (posting service exists; approval workflow is Task 010/011) · deterministic-over-AI ◐ (validators arrive in Task 006/009) · EU/zero-retention ◐ (infra + vendor later) · EUR/exact-decimal ✓ (ledger uses `numeric`) · UI-permissions-as-hints ✓ (server re-authorizes) · secrets-not-in-code ✓.
(✓ enforced · ◐ partially / pending its task.)
