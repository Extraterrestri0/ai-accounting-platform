# TASK 009 — Rules Engine MVP

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 009 · **Depends on:** 002–008 · **PR:** one scoped PR.
**Deliverable:** `task009-rules-engine.zip` → unzip into repo root over Tasks 002–008 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0010 applied; RLS isolation, rule-version immutability, one-current-suggestion, supplier-history/duplicate lookup, and AI-actor audit all proved; the engine logic ran green in Node and Jest; `tsc` clean, `eslint` clean, **23/23 tests pass**; 0010 down→up round-trips. No redesign of prior tasks; no new frameworks.

## 1. Files created
- DB: `db/migrations/0010_rules_suggestions.{up,down}.sql`.
- rules domain: `domain/rules/models.ts`, `domain/rules/rules-engine.ts` (pure deterministic matching/suggestion/aggregation).
- application: `rules-engine.service.interface.ts`, `rules-engine.service.ts`.
- infrastructure: `rule.repository.ts` (versioned rules), `suggestion.repository.ts` (history, duplicate, save, get).
- api: `suggestions.controller.ts` + `dto/suggestions.dto.ts`.
- docs `docs/RULES_ENGINE.md`; tests `test/rules/rules-engine.spec.ts`; frontend `apps/web/components/domain/documents/SuggestionReviewScreen.tsx`.

## 2. Files modified
- `docintel/docintel.module.ts` (imports `MasterDataModule`; provides the rules-engine service + repos + controller), `application/index.ts`, `index.ts` — extended only. No prior-task logic touched; reused existing permissions (`DOCUMENT_UPLOAD`, `COMPANY_READ`, `MASTERDATA_WRITE`).

## 3. Database changes (migration 0010)
- `rules` — company-scoped (`rule_type`, `name`, `match_key`, `is_active`).
- `rule_versions` — append-only/immutable (deny_mutation trigger), `definition` jsonb, `UNIQUE(tenant,rule_id,version_no)`.
- `accounting_suggestions` — `counterparty_id`/`suggested_account_id` FKs, `suggested_posting` jsonb, `confidence`, `explanation`, `status`, `is_duplicate`/`duplicate_of_document_id`; **partial unique** `uq_current_suggestion` (one `suggested` per document).
- `vat_suggestions` — `suggested_vat_code_id` FK, `treatment` CHECK, `rate`, `confidence`, `explanation`.
- All four ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **AI suggests, never posts (Invariant 4/5):** the engine has no ledger dependency, writes only rules/suggestion tables, and audits as actor **`ai`**. The proposed posting is a jsonb skeleton, not a journal entry.
- **Deterministic (Invariant 6):** matching/suggestion/VAT/confidence are pure deterministic functions; validated extraction inputs feed in.
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A). **Rule versions immutable** (DB-proven). One current suggestion per document (partial unique).

## 5. Test results
- **Live DB proofs (ran):** rule+version + accounting/VAT suggestions created · rule_versions UPDATE blocked · second current suggestion blocked · RLS isolation (B↮A) · supplier-history/duplicate lookup · audit chain valid (actor `ai`) → **all PASS**.
- **Unit (jest, ran):** supplier matching (EIK/VAT/name/none) · account from rule / history (18→602@0.88) / default · VAT (BG standard→STD20, EU→intra_community, unregistered→none) · confidence aggregation → **PASS**.
- Maps to required cases: supplier matching, VAT matching, duplicate detection, confidence scoring, tenant isolation, audit generation.
- Combined suite: **23/23**; `tsc` clean; `eslint` clean.

## 6. Suggestion examples
Matching the brief: supplier **Acme OOD** (matched by EIK 111111113) → suggest account **602 External Services**, confidence **0.88**, reason *"Previous 18 invoices from this supplier posted to account 602."* VAT: BG 20% → **standard / STD20** @0.9. Aggregate suggestion confidence **0.91**. Proposed posting: Dr 602 200.00, Dr 4531 (VAT input) 40.00, Cr 401 (Suppliers) 240.00 — *not booked*.

## 7. UI preview screenshots
Rendered inline above: the Suggestion Review screen — suggested account (602) + VAT (standard 20%) metric cards, a 91% confidence bar, the explanation banner ("Previous 18 invoices…"), the proposed (not-yet-booked) posting table, and Accept/Edit/Reject actions. Component at `apps/web/components/domain/documents/SuggestionReviewScreen.tsx`.

## 8. Known limitations
- **Supplier history bootstraps from prior suggestions** (no posting history until Task 011); once postings exist, history can read accepted journal entries for stronger signals — same `suggestedAccount` contract.
- **Default account (602) and VAT-input/payables codes (4531/401) are hard-coded MVP defaults**; should come from a configurable company chart mapping (rules already support `default_account`).
- **Duplicate detection** keys on invoice number across the company's current extractions; supplier+number+amount would be stronger (easy extension).
- The engine is **deterministic** (no LLM); an AI ranking layer can slot in behind the same suggestion contract without schema/service changes.
- Frontend is a representative screen + preview (not type-checked in the backend harness); confidence weights are heuristic constants to tune with pilot data.

## 9. Next recommended task
**Task 010 — Review Queue** (human approval workflow). Acceptance met: it consumes `IRulesEngineService.getSuggestion` (account + VAT + posting + confidence + explanation + duplicate flag) and the extraction review package; the reviewer accepts/edits/rejects, and Task 011 turns an accepted suggestion into a human-approved journal entry — no redesign of these tables.

---
*Production-ready backend + migration + deterministic engine + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(docintel): rules engine MVP — account/VAT suggestions with confidence (AI suggests, never posts)`.*
