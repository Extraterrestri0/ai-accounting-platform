# TASK 011 — Posting Workflow

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 011 · **Depends on:** 002–010 · **PR:** one scoped PR.
**Deliverable:** `task011-posting.zip` → unzip into repo root over Tasks 002–010 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0012 applied; balanced posting, unbalanced rejection, reversal (one-per-original), no-double-post, result immutability, RLS, and audit-chain-after-posting all proved against the real ledger schema; posting validation ran green in Node and Jest; `tsc` clean, `eslint` clean, **33/33 tests pass**; 0012 down→up round-trips. No redesign of prior tasks; no new frameworks.

## 1. Files created
- DB: `db/migrations/0012_posting.{up,down}.sql`.
- posting domain: `domain/posting/models.ts`, `domain/posting/validation.ts` (deterministic balance/account checks).
- application: `posting.service.interface.ts`, `posting.service.ts`.
- infrastructure: `posting.repository.ts`.
- api: `postings.controller.ts` + `dto/postings.dto.ts`.
- docs `docs/POSTING_WORKFLOW.md`; tests `test/posting/posting-validation.spec.ts`; frontend `apps/web/components/domain/posting/PostingReviewScreen.tsx`.

## 2. Files modified
- `docintel/docintel.module.ts` — imports `LedgerModule`; provides `PostingService` + `PostingRepository` + controller. `application/index.ts`, `index.ts` extended. No prior-task logic touched; reused `LEDGER_POST`/`LEDGER_REVERSE`/`COMPANY_READ` permissions from Task 005.
- **Dependency direction:** the posting workflow lives in DocIntel (higher-level) and depends on the foundational Ledger (Task 004) — never the reverse. The ledger stays pure.

## 3. Database changes (migration 0012)
- `posting_requests` — human-authorized (`requested_by`), `kind` (post/reversal), `status` (pending/posted/failed), resolved `lines` jsonb; **partial unique** `uq_posted_per_review` (at most one successful post per review — no double-posting).
- `posting_results` — append-only (deny_mutation), link to `journal_entries(tenant_id, id)` (+ `reverses_entry_id`).
- Both ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **Human-approved only; AI cannot post** — enforced by the app guard (`requireHuman` refuses no-userId identities) + the `LEDGER_POST` permission; the ledger records the entry under `created_by_actor_type='user'`. The posting only proceeds from a `status='approved'` review (a human decision). Reversal requires `LEDGER_REVERSE`.
- **Immutable ledger, reversal-only (Invariant 2):** uses the Task 004 ledger, which rejects unbalanced entries at COMMIT and blocks update/delete; corrections are reversing entries (one per original, proved).
- **Validation:** balanced-only, positive amounts, valid+postable accounts, tenant+company scoped — pre-checked deterministically (friendly errors) then re-enforced authoritatively by the ledger.
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A); `posting_results` immutable; fully audited (`ledger.posted_from_review`, `ledger.reversed`) on the hash chain.

## 5. Test results
- **Live DB proofs (ran, against the real ledger schema):** balanced posting (net 0.00, request posted, result linked) · unbalanced rejected at COMMIT · reversal mirrors directions + one-per-original · double-posting per review blocked · posting_results immutable · RLS isolation (B↮A) · audit chain valid (actor `user`) → **all PASS**.
- **Unit (jest, ran):** balanced accepted · unbalanced rejected · <2 lines rejected · invalid account rejected · non-positive rejected · exact-decimal cents (no float drift) → **PASS**.
- Maps to required cases: balanced posting, unbalanced rejected, invalid account rejected, reversal entry, tenant isolation, audit generation.
- Combined suite: **33/33**; `tsc` clean; `eslint` clean.

## 6. Journal entry examples
Approved review for Acme OOD → posted entry: **Dr 602 External Services 200.00 · Dr 4531 VAT input 40.00 · Cr 401 Suppliers 240.00** (debits 240.00 = credits 240.00). Reversal of that entry: **Cr 602 200.00 · Cr 4531 40.00 · Dr 401 240.00**, `reverses_entry_id` → original, one reversal per original enforced. Amounts are exact decimals (string), currency EUR (Invariant 8).

## 7. UI screenshots
Rendered inline above: the Posting screen — approved badge, the workflow trail (Review approved → Posting request → Ledger validation → Journal entry → Audit event), the immutable journal entry table with a balanced total, the disabled "Post to ledger" (already posted) + "Reverse entry" action, and the immutability note. Component at `apps/web/components/domain/posting/PostingReviewScreen.tsx`.

## 8. Known limitations
- **Multi-step (not single-transaction) with the ledger:** since the Task 004 `LedgerService.postEntry` manages its own transaction, posting writes the `posting_request` (pending) → calls the ledger → records the result/flips status in a follow-up transaction. The ledger entry itself is atomic; the `posting_requests.status` is the reconciliation point (a stuck `pending` indicates a ledger failure, captured as `failed`). A future enhancement could let the ledger accept an external unit-of-work to make the whole flow one transaction.
- Posting is triggered by an authenticated human action; an automated "post on approve" step would still carry the approver's authorization but is deferred to the workers task.
- The approved posting uses the review's `approved_posting` (falling back to the suggestion's proposed posting); richer per-line editing lands with the review edit UI.
- Frontend is a representative screen + preview (not type-checked in the backend harness).

## 9. Next recommended task
**Task 012 — VAT Module MVP.** Acceptance met: posted entries are available via `posting_results.journal_entry_id` → immutable `journal_entries`/`journal_lines` (balanced, EUR), with VAT amounts on the configured VAT accounts (e.g. 4531). The VAT module reads these to build returns — no redesign of these tables required.

---
*Production-ready backend + migration + ledger integration + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(docintel): posting workflow — approved reviews → immutable journal entries (human-approved; AI cannot post)`.*
