# TASK 014 — Financial Reports

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 014 · **Depends on:** 002–013 · **PR:** one scoped PR.
**Deliverable:** `task014-reports.zip` → unzip into repo root over Tasks 002–013 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0015 applied; trial-balance balancing, P&L, account-card running balance, snapshot immutability, RLS, and audit all proved from posted entries; the report engine ran green in Node and Jest; `tsc` clean, `eslint` clean, **53/53 tests pass**; 0015 down→up round-trips. No redesign of prior tasks; no new frameworks.

## 1. Files created
- DB: `db/migrations/0015_reports.{up,down}.sql`.
- reporting domain: `domain/reports/models.ts`, `domain/reports/calculator.ts` (pure trial balance / P&L / balance sheet / account card / general ledger / journal).
- application: `reports.service.interface.ts`, `reports.service.ts`.
- infrastructure: `reports.repository.ts` (read-only ledger/journal/invoice reads + run/snapshot writes).
- api: `reports.controller.ts` + `dto/reports.dto.ts`.
- docs `docs/REPORTS.md`; tests `test/reporting/reports-calculator.spec.ts`; frontend `apps/web/components/domain/reporting/{ReportsDashboardScreen,TrialBalanceScreen,GeneralLedgerScreen,ProfitAndLossScreen,VatReportScreen}.tsx`.

## 2. Files modified
- `reporting/reporting.module.ts` (imports `TaxModule`, `AuditModule`; adds `REPORTS_SERVICE` + `ReportsRepository` + `ReportsController` alongside the Task 002 stub), `reporting/application/index.ts`, `reporting/index.ts` — extended only. No prior-task logic touched; reused `LEDGER_READ`/`VAT_READ`/`INVOICE_READ`. (`AppModule` already imports `ReportingModule`.)

## 3. Database changes (migration 0015)
- `report_runs` — generation audit (`report_type` CHECK over the 8 reports, `params` jsonb, `generated_by`, status).
- `report_snapshots` — append-only computed dataset (**immutable** via deny_mutation), `payload` jsonb + checksum, period bounds.
- Both ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **Reads immutable sources only; never writes the ledger.** Reporting reads `journal_entries`/`journal_lines`/`accounts`/`invoices` (read-only) and delegates the VAT report to the tax context; it writes only `report_runs`/`report_snapshots`.
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A). Snapshots **immutable** (DB-proven). Every generation audited (`reporting.report_generated`) on the hash chain.
- Read endpoints guarded by `ledger.read` / `vat.read` / `invoice.read`. Exact-decimal arithmetic (no float).

## 5. Test results
- **Live DB proofs (ran):** trial balance balances (debits 400.00 = credits 400.00) · P&L (revenue 300 − expense 100 = profit 200) · account card 411 net 300.00 · report run + snapshot immutability · RLS isolation (B↮A) · audit chain valid (actor `user`) → **all PASS**.
- **Unit (jest, ran):** trial balance balanced + per-account balance · general ledger grouping/totals/running balance · account card closing balance · P&L net profit · balance-sheet consistency (assets = liabilities + equity) → **PASS**.
- Maps to required cases: trial balance balances, general ledger totals, account card totals, P&L calculations, VAT report consistency, tenant isolation, audit generation.
- Combined suite: **53/53**; `tsc` clean; `eslint` clean.

## 6. Report examples
For April 2026 with a posted sale (Dr 411 300 / Cr 702 300) and expense (Dr 602 100 / Cr 401 100):
**Trial balance** — 401 −100.00, 411 300.00, 602 100.00, 702 −300.00; totals debit 400.00 = credit 400.00 (balanced).
**P&L** — revenue 300.00, expenses 100.00, **net profit 200.00**. **Balance sheet** — assets 300.00, liabilities 100.00, equity (incl. result) 200.00 → balanced. **VAT report** (from the tax context) — output 60.00 − deductible 40.00 = **payable 20.00**. **Account card 411** — closing balance 300.00. **Invoice report** — issued invoices with net/VAT/gross.

## 7. UI screenshots
Rendered inline above: the trial balance (with balanced check + drill-down links), and P&L / balance-sheet / VAT-report cards — all derived from the immutable ledger. Five components shipped under `apps/web/components/domain/reporting/` (Dashboard, Trial Balance, General Ledger, P&L, VAT Report).

## 8. Known limitations
- **Balance sheet is the basic MVP**: classifies by account `type` and rolls the current-period result into equity; it does not yet split current vs non-current, retained earnings vs current result, or prior-year carry-forward — those need opening balances / year-end close (a later task).
- **No opening balances**: trial balance / account card cover the queried period only (period activity). Opening-balance carry-forward arrives with the fiscal-year-close task.
- **Snapshots are opt-in** (trial balance / P&L / balance sheet); a scheduled month-end snapshot job is deferred to the infrastructure task.
- VAT report consistency relies on the VAT registers having been built for the period (Task 012 `buildRegisters`); the report reads the current summary.
- Frontend is representative screens + preview (not type-checked in the backend harness).

## 9. Next recommended task
**Task 015 — Dashboard** (or **016 — Production Infrastructure**). Acceptance met: the platform demonstrates **Invoice → Ledger → VAT → Reports** end-to-end — an issued invoice's posted entry flows into the trial balance, P&L, balance sheet, VAT report, and invoice report from the same immutable ledger, no redesign.

---
*Production-ready backend + migration + deterministic report engine + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(reporting): financial reports — trial balance, GL, P&L, balance sheet, VAT, invoices (reads immutable ledger)`.*
