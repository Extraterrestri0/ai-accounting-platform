# TASK 010 — Review Queue

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 010 · **Depends on:** 002–009 · **PR:** one scoped PR.
**Deliverable:** `task010-review-queue.zip` → unzip into repo root over Tasks 002–009 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0011 applied; RLS isolation, **AI-cannot-act DB CHECK**, action/comment immutability, one-package-per-document, human-approval flow, and audit-chain-after-decision all proved; the workflow logic ran green in Jest; `tsc` clean, `eslint` clean, **27/27 tests pass**; 0011 down→up round-trips. No redesign of prior tasks; no new frameworks. This is the human approval checkpoint before posting.

## 1. Files created
- DB: `db/migrations/0011_review_queue.{up,down}.sql`.
- review domain: `domain/review/models.ts`, `domain/review/workflow.ts` (pure status/human rules).
- application: `review.service.interface.ts`, `review.service.ts`.
- infrastructure: `review.repository.ts`.
- api: `reviews.controller.ts` + `dto/reviews.dto.ts`.
- docs `docs/REVIEW_QUEUE.md`; tests `test/review/review-workflow.spec.ts`; frontend `apps/web/components/domain/review/{ReviewQueueScreen,ReviewDetailScreen,ReviewerDashboardScreen}.tsx`.

## 2. Files modified
- `docintel/docintel.module.ts` (provides `ReviewService` + `ReviewRepository` + controller), `application/index.ts`, `index.ts` — extended only. `review.service.ts` uses the pure `nextStatus`. No prior-task logic touched; reused existing `REVIEW_APPROVE`/`COMPANY_READ` permissions from Task 005.

## 3. Database changes (migration 0011)
- `review_packages` — one per document (`UNIQUE(tenant,document_id)`); lifecycle `pending/approved/rejected/needs_correction`; `assigned_reviewer_id`; `approved_account_id`/`approved_vat_code_id`/`approved_posting` (the human-approved result Task 011 consumes); `decided_by`/`decided_at`.
- `review_actions` — append-only (deny_mutation trigger), **human-only**: `CHECK (actor_type = 'user')`; full decision log with `payload` jsonb.
- `review_comments` — append-only discussion thread.
- All three ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **Human approval required; AI cannot approve/reject/edit/post** — enforced in THREE layers: RBAC permission `review.approve`, an application guard (`requireHuman` rejects no-userId identities), and a **database CHECK** `review_actions.actor_type='user'` (proved: an `actor_type='ai'` insert is rejected).
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A). Actions & comments **immutable** (DB-proven).
- **Fully audited:** reviewer, timestamp, changes, and comments recorded in both `review_actions` and the hash-chained audit log (actor `user`); chain validates.

## 5. Test results
- **Live DB proofs (ran):** package + assign + comment · **AI approve blocked at DB** · human approve → approved · action UPDATE blocked · one-package-per-document · RLS isolation (B↮A) · audit chain valid (actor `user`) → **all PASS**.
- **Unit (jest, ran):** action→status mapping (approve/reject/request_correction; non-decisions keep status) · every action requires a human · decision classification → **PASS**.
- Maps to required cases: approve, reject, edit, reviewer assignment, audit generation, tenant isolation.
- Combined suite: **27/27**; `tsc` clean; `eslint` clean.

## 6. UI screenshots
Rendered inline above: the Reviewer Dashboard counters (pending / needs-correction / assigned-to-me / approved / rejected) and the Review Queue with per-row suggestion + confidence + flags (low-confidence, duplicate) and an inline Approve action — plus the lock note that only humans can decide. Three components shipped under `apps/web/components/domain/review/` (Queue, Detail with document preview + fields + suggestion + actions, Dashboard).

## 7. Known limitations
- **Edit** records the human override (account/VAT/posting) on the package + an `edit` action; it does not mutate the immutable AI extraction/suggestion (by design). A richer field-level edit UI can build on the same action log.
- Review packages are created on demand / when suggestions are ready; auto-creation on `SuggestionReady` is wired via the queue/event in the workers task (the `createPackage` entrypoint is ready).
- Reviewer assignment references a user id but does not yet validate company membership of the assignee (add via the identity service when multi-reviewer flows land).
- Frontend is representative screens + preview (not type-checked in the backend harness).

## 8. Next recommended task
**Task 011 — Posting Workflow.** Acceptance met: it consumes approved reviews (`review_packages.status='approved'` + `approved_posting`/account/VAT) and turns the human-approved proposal into a real, balanced **journal entry** via the Task 004 ledger (the AI never posts; the human approval is the authorization). No redesign of these tables.

---
*Production-ready backend + migration + workflow + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(docintel): review queue — human approval workflow (AI cannot approve/reject/post)`.*
