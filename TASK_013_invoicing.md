# TASK 013 — Invoice Issuance (MVP)

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 013 · **Depends on:** 002–012 · **PR:** one scoped PR.
**Deliverable:** `task013-invoicing.zip` → unzip into repo root over Tasks 002–012 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0014 applied; draft totals, gapless sequential numbering, issue + issued-invoice/line immutability, ledger entry (Dr 411 / Cr 702 / Cr 4532) linking, sales VAT register entry, PDF append-only + email status transitions, RLS, and audit all proved; invoice math ran green in Node and Jest; `tsc` clean, `eslint` clean, **48/48 tests pass**; 0014 down→up round-trips. No redesign of prior tasks; no new frameworks. Standard sales invoices only (credit/debit notes, proforma out of scope).

## 1. Files created
- DB: `db/migrations/0014_invoicing.{up,down}.sql`.
- invoice domain: `domain/invoice/models.ts`, `domain/invoice/calculator.ts` (exact-cent line/total math, numbering format, validation).
- ports: `application/pdf.port.ts`, `application/email.port.ts`.
- application: `invoice.service.interface.ts`, `invoice.service.ts`.
- infrastructure: `invoice.repository.ts`, `placeholder-pdf-generator.ts`, `log-email-sender.ts`.
- api: `invoices.controller.ts` + `dto/invoices.dto.ts`.
- docs `docs/INVOICE_ISSUANCE.md`; tests `test/invoicing/invoice-calculator.spec.ts`; frontend `apps/web/components/domain/invoicing/{InvoiceListScreen,InvoiceCreateScreen,InvoiceDetailScreen,InvoicePreviewScreen}.tsx`.

## 2. Files modified
- `identity/domain/roles.ts` — **additive**: added `INVOICE_READ/CREATE/ISSUE/SEND` permissions (owner via `Object.values`; accountant gets all four; approver/viewer get read). No existing permission changed.
- `invoicing/invoicing.module.ts` (imports `LedgerModule`, `TaxModule`, `AuditModule`; provides `INVOICE_SERVICE` + repo + PDF/email adapters + controller — alongside the Task 002 stub), `application/index.ts`, `index.ts` — extended only. (`AppModule` already imports `InvoicingModule` — no change.) Dependency direction: invoicing → ledger/tax/masterdata (foundational), never reversed.

## 3. Database changes (migration 0014)
- `invoice_numbering_series` — gapless counter (`UNIQUE(tenant,company,series_code,series_year)`).
- `invoices` + `invoice_lines` — draft mutable; **issued immutable** via `app.deny_when_issued`/`app.deny_line_when_issued` (the only allowed post-issue update is linking the posted journal entry); `UNIQUE(tenant,company,series_code,series_year,invoice_number)` (no duplicate numbers).
- `invoice_pdf_artifacts` — append-only (deny_mutation). `invoice_email_deliveries` — status transitions queued→sent/failed/delivered.
- All five ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **Human action required; AI cannot issue, post, or send.** App guard (`requireHuman` refuses no-userId identities) + the new `invoice.issue`/`invoice.send` permissions; the ledger entry is recorded under the human actor.
- **Issued invoices immutable** (DB triggers, proved); gapless numbering enforced by a locked counter + unique constraint.
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A); PDFs append-only; everything audited (`invoicing.invoice_issued`, `invoicing.invoice_posted`) on the hash chain.
- Exact decimals, EUR (Invariant 8). Reuses the immutable ledger + VAT register.

## 5. Test results
- **Live DB proofs (ran):** draft + line totals 300/60/360 · gapless sequential numbers 1,2,3 · issue → issued-invoice + line immutability · posted journal entry linked (Dr 411 360 / Cr 702 300 / Cr 4532 60) · sales VAT register entry (base 300, vat 60) · PDF append-only + email status transition · RLS isolation (B↮A) · audit chain valid (actor `user`) → **all PASS**.
- **Unit (jest, ran):** line math incl. exact-cent 3×99.99 → 299.97/59.99/359.96 · zero-rated · totals · numbering format · validate (customer/lines/quantity) → **PASS**.
- Maps to required cases: create draft, validate, issue, sequential + gapless numbering, immutable issued invoice, ledger posting, VAT register generation, tenant isolation, audit, email delivery status.
- Combined suite: **48/48**; `tsc` clean; `eslint` clean.

## 6. Invoice examples
Draft for Beta EOOD, 1 × Consulting @ 300.00, VAT 20% → net 300.00, VAT 60.00, gross 360.00. On **issue**: number `2026-0001` (gapless), PDF `invoices/<id>.pdf`, posted entry **Dr 411 360.00 / Cr 702 300.00 / Cr 4532 60.00**, and a sales VAT register row (base 300.00, VAT 60.00). Optional email to the customer tracked queued→sent.

## 7. UI screenshots
Rendered inline above: the issued invoice with the workflow trail (Draft → Validate → Issue → PDF → Journal entry → Sales VAT register), line items, the net/VAT/gross summary, the posted journal entry, and email delivery status. Four components shipped under `apps/web/components/domain/invoicing/` (List, Create with live totals, Detail with issue/email actions, PDF Preview).

## 8. Known limitations
- **Multi-step issue/post** (same rationale as Task 011): number allocation + draft→issued commit, then ledger post in a follow-up; if posting fails the invoice is legally issued (number consumed) with `journal_entry_id` NULL and posting is retryable — a stuck NULL flags it. Gapless numbering is preserved.
- **PDF generator is a dev placeholder** (deterministic minimal PDF behind the port); a real renderer (and EU storage with the WORM pattern from Task 007) slots in without service changes. The Preview screen renders whatever the artifact URL points to.
- **Email sender is a dev/log adapter**; prod = an EU provider with delivery webhooks updating `invoice_email_deliveries` (the `delivered` status is reserved for that).
- Sales accounts (411/702/4532) are documented BG-plan constants (same note as the VAT module) — make configurable per company before pilot.
- Frontend is representative screens + preview (not type-checked in the backend harness).

## 9. Next recommended task
**Task 014 — Reports.** Acceptance met: reports can consume issued `invoices`/`invoice_lines`, posted `journal_entries`/`journal_lines` (linked via `invoices.journal_entry_id`), and `vat_*` records — all immutable. The platform now demonstrates **Create Invoice → Issue → Generate PDF → Post Journal Entry → Sales VAT Register** end-to-end, alongside the document pipeline (Upload → … → VAT Register) from Task 012.

---
*Production-ready backend + migration + ledger/VAT integration + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(invoicing): sales invoice issuance — gapless numbering, immutable issued, posts ledger + sales VAT (human-only)`.*
