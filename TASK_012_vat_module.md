# TASK 012 — VAT Module MVP

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 012 · **Depends on:** 002–011 · **PR:** one scoped PR.
**Deliverable:** `task012-vat-module.zip` → unzip into repo root over Tasks 002–011 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0013 applied; register build from posted entries, summary/return calc (payable 20.00), duplicate prevention, register immutability, RLS, and audit all proved; the VAT engine ran green in Node and Jest; `tsc` clean, `eslint` clean, **39/39 tests pass**; 0013 down→up round-trips. No redesign of prior tasks; no new frameworks. **This task completes the end-to-end MVP pipeline.**

## 1. Files created
- DB: `db/migrations/0013_vat.{up,down}.sql`.
- VAT domain: `domain/vat/models.ts`, `domain/vat/calculator.ts` (pure classify/treatment/summarize/return/validate).
- application: `vat.service.interface.ts`, `vat.service.ts`.
- infrastructure: `vat.repository.ts` (read-only ledger reads + VAT-table writes).
- api: `vat.controller.ts` + `dto/vat.dto.ts`.
- docs `docs/VAT_MODULE.md`; tests `test/vat/vat-calculator.spec.ts`; frontend `apps/web/components/domain/vat/{VatDashboardScreen,RegisterScreen,VatSummaryScreen}.tsx`.

## 2. Files modified
- `tax/tax.module.ts` (imports `AuditModule`; adds `VAT_SERVICE` + `VatRepository` + `VatController` alongside the Task 002 stub), `tax/application/index.ts`, `tax/index.ts` — extended only. No prior-task logic touched; reused `VAT_READ` permission from Task 005. (`AppModule` already imports `TaxModule` — no change needed.)

## 3. Database changes (migration 0013)
- `vat_periods` — monthly (`UNIQUE(tenant,company,year,month)`), `status` open/closed/submitted, `starts_on`/`ends_on`.
- `vat_register_entries` — derived purchase/sales rows (`base_amount`/`vat_amount`/`deductible_amount`, `treatment`, `vat_code_id`); **append-only** (deny_mutation); `UNIQUE(tenant,journal_entry_id,register_kind)` (no duplicate register rows per posted entry).
- `vat_returns` — period `output_vat`/`deductible_vat`/`vat_payable`/`vat_refundable` + СД `dataset` jsonb; one per period.
- All three ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **Reads the immutable ledger only; never writes it.** The tax context reads `journal_entries`/`journal_lines` (read-only) + VAT codes and writes only `vat_*` tables.
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A). Register rows **immutable** (DB-proven). Duplicate register entries blocked at the DB.
- **Audited:** `tax.vat_registers_built` and `tax.vat_return_generated` on the hash-chained log; chain validates.
- Deterministic calculations (exact decimals, EUR — Invariant 8); no float.

## 5. Test results
- **Live DB proofs (ran):** registers built from posted entries (purchase 200/40, sales 300/60) · summary output 60 / deductible 40 / payable 20 / refundable 0 · duplicate register entry blocked · register immutability · RLS isolation (B↮A) · audit chain valid → **all PASS**.
- **Unit (jest, ran):** purchase VAT · sales VAT · deductible VAT & VAT payable (60−40=20) · refundable position (input>output) · return dataset cells · validation (duplicate / missing code / invalid treatment) → **PASS**.
- Maps to required cases: purchase VAT, sales VAT, deductible VAT, VAT payable, duplicate detection, tenant isolation, audit generation.
- Combined suite: **39/39**; `tsc` clean; `eslint` clean.

## 6. VAT examples
April 2026: a posted **purchase** (Dr 602 200.00 / Dr 4531 40.00 / Cr 401 240.00) → purchase register row base 200.00, VAT 40.00, deductible 40.00, treatment standard. A posted **sale** (Dr 411 360.00 / Cr 702 300.00 / Cr 4532 60.00) → sales register row base 300.00, VAT 60.00. **Summary:** output VAT 60.00, deductible 40.00, **VAT payable 20.00**, refundable 0.00. СД cells: `cell11_taxableBaseSales=300.00`, `cell50_outputVat=60.00`, `cell40_vatPayable=20.00`.

## 7. UI screenshots
Rendered inline above: the VAT Dashboard (output / deductible / payable / refundable cards with payable highlighted) and the side-by-side Purchase and Sales registers with totals. Four components shipped under `apps/web/components/domain/vat/` (Dashboard, Register [purchase/sales], Summary/return).

## 8. Known limitations
- **VAT account convention** (4531 input / 4532 output) is a documented MVP constant; should become a configurable per-company mapping (a `company_settings` extension) before pilot.
- **Treatment is derived from the posted rate** (20→standard, 9→reduced, 0→zero); reverse-charge / intra-community / import nuances (which post differently) are recognized in the model but the classifier focuses on standard domestic flows for MVP — the register row carries `treatment` so these can be refined without schema change.
- **Reversals** are excluded from registers (`reverses_entry_id IS NULL` filter); net-of-reversal handling for amended periods is a follow-up.
- The СД dataset is an MVP subset of cells (enough to demonstrate payable/refundable); the full NAP XML schema + submission is a later task (`VAT_SUBMIT` permission already reserved for separation of duties).
- Frontend is representative screens + preview (not type-checked in the backend harness).

## 9. Next recommended task
**Task 013 — Invoice Issuance** (or **Task 014 — Reports**). The MVP acceptance is now demonstrable end-to-end: **Upload → OCR → Extraction → Suggestions → Human Review → Approval → Journal Entry → VAT Register**, each step verified on live PostgreSQL, with the AI structurally unable to post and every state change audited.

---
*Production-ready backend + migration + deterministic VAT engine + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(tax): VAT module MVP — BG registers + return dataset from posted entries (reads immutable ledger)`.*
