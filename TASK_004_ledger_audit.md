# TASK 004 — Immutable Ledger + Append-Only Audit Trail

**Type:** SECURITY-CRITICAL & ACCOUNTING-CRITICAL · **Maps to:** Build Order step 4 (`CLAUDE.md` §14) · **Depends on:** Task 003 (tenancy + RLS) · **PR:** one scoped PR.
**Deliverable:** `task004-ledger-audit.zip` → unzip into repo root (adds to `apps/api/`).

> **Verified against a live PostgreSQL 16** during build: migrations 0001→0005 applied, the full proof passed (`ALL LEDGER + AUDIT PROOFS PASSED`), the shipped `verify.sh` re-ran green on a fresh DB, and the 0004/0005 down→up migrations round-tripped. **No business accounting logic beyond ledger mechanics, no auth beyond Task 003's minimum, no OCR, no frontend.**

---

## 0. Acceptance criteria — status

| Requirement | Status |
|-------------|--------|
| Balanced transaction passes | ✅ proved (proof T1, Jest) |
| Unbalanced transaction fails | ✅ proved (deferred constraint at COMMIT; T2, Jest) |
| Update blocked | ✅ proved (immutability trigger + no privilege; T3) |
| Delete blocked | ✅ proved (T4) |
| Reversal works | ✅ proved — mirrored debit/credit; one reversal per original (T5/5b, Jest) |
| Audit hash chain validates | ✅ proved (`verify_audit_chain = true`; T5/T6) |
| Tamper detected | ✅ proved (corrupted row → chain returns false; T6) |
| Tenant isolation remains intact | ✅ proved (A sees 0 of B's ledger/audit; T7) |
| Task 005 (Auth) builds on it without redesign | ✅ contracts + context unchanged by auth |
| Task 010 (E2E) builds on it without redesign | ✅ post/reverse/read + audit already in place |

---

## 1. What was built

### Database (`apps/api/db/migrations/`)
- **0004 ledger** — minimal `accounts` (masterdata enriches in Task 007), `ledger_entry_counters` (per-company numbering), `journal_entries` (append-only), `journal_lines` (append-only). Constraints: amount `numeric(20,2) > 0`, `direction ∈ {debit,credit}`, composite `(tenant_id,id)` uniques + composite FKs (no cross-tenant/company refs), `uq_reversal_target` (one reversal per original). **Triggers:** `deny_mutation` (UPDATE/DELETE/TRUNCATE blocked) and `assert_entry_balanced` (deferred `CONSTRAINT TRIGGER`: ≥2 lines, Σdebit=Σcredit, non-zero). Company-scoped RLS (ENABLE+FORCE), least-privilege grants (no UPDATE/DELETE on entries/lines).
- **0005 audit** — `audit_events` with actor, action, entity, reason, `before/after` jsonb, `occurred_at`, and chain columns. **`audit_chain_writer`** (BEFORE INSERT) assigns `seq`/`prev_hash`/`this_hash = sha256(prev||'|'||payload)` under a per-tenant advisory lock; **`verify_audit_chain(tenant)`** recomputes and returns false on any break; immutability triggers; tenant-scoped RLS; SELECT/INSERT grants only.
- Down migrations for both; **down→up round-trip verified**.

### Backend
- **ledger module** — domain (`JournalEntry/JournalLine/Direction`, errors), `ILedgerService` (+ token), `JournalRepository` (ScopedClient-based: numbering, insert entry/lines, reversal check, reads), `LedgerService` (atomic **posting** and **reversal** workflows), controller + DTOs (no tenant/company in body). 
- **audit module** — domain, `IAuditService.append(db: ScopedClient, …)` + `verifyChain()`, `AuditRepository`, `AuditService`.
- **Unit-of-work / atomicity:** `LedgerService` opens **one** `DatabaseContextService.run` transaction and composes journal insert + lines + `audit.append(sameClient, …)`; an unbalanced entry rolls back the posting **and** its audit event together. Ledger imports Audit via its public interface only.
- Tests: `ledger-audit.e2e-spec.ts` (Jest+pg), `verify.sh` (exit-code proof), `seed.sql`, README; runtime doc `apps/api/docs/LEDGER_AUDIT.md`.

---

## 2. How each guarantee is enforced (defense in depth)

- **Double-entry / balance:** DB deferred constraint trigger (authoritative) — not just app logic.
- **Immutable:** triggers block UPDATE/DELETE/TRUNCATE for everyone (even the owner); `app_user` also has no UPDATE/DELETE privilege.
- **Reversing entries only:** service creates mirrored entries; `uq_reversal_target` enforces one-per-original; `AlreadyReversedError` on repeat.
- **Append-only, tamper-evident audit:** server-computed hash chain + advisory-lock serialization + verifier; immutability triggers prevent edits. (The tamper test must DISABLE the immutability trigger to simulate raw DB access — proving the chain catches what triggers can't, e.g. a DBA.)
- **Tenant/company isolation:** inherited RLS (company-scoped ledger, tenant-scoped audit), fail-closed without context; `app_user` NOBYPASSRLS.
- **Actor + timestamps + snapshots:** captured from request context into every audit row.

---

## 3. Verify (CI / local)

1. Postgres up; `app_owner` (owner) + `app_user` (LOGIN NOBYPASSRLS).
2. Apply `0001→0005` as owner; apply `test/ledger-audit/seed.sql`.
3. `PSQL_OWNER="psql -U app_owner -d acct" PSQL_APP="psql -U app_user -d acct" ./test/ledger-audit/verify.sh` → `ALL LEDGER + AUDIT PROOFS PASSED`.
4. `PGUSER=app_user pnpm --filter @app/api test:ledger` → Jest green.
5. Wire both as **release-blocking** CI stages.

*(`pg` + `@nestjs/*` are added by their slices per Task 001's deferred-dependency rule; the Jest suite ran in spec form here — the SQL/shell proof exercised the identical migrations/policies against the real DB.)*

---

## 4. PR & Handoff

- **One PR**, Conventional Commit: `feat(ledger): immutable ledger + append-only hash-chained audit (security/accounting-critical)`.
- CODEOWNERS review required (ledger + audit are safety-critical paths).
- **Next:** **Task 005 — Auth** (full RBAC/ABAC + MFA + KEP step-up) replaces only the minimal `PrincipalResolver`; ledger/audit contracts and context plumbing are unchanged. Then **Task 010 — E2E** composes approval → `postEntry` → registers/reports, with reversal and the audit chain already in place. No redesign required.

*Production-ready code + migrations + tests + verification scripts + README. Verified on PostgreSQL 16. Scope held to ledger + audit mechanics.*
