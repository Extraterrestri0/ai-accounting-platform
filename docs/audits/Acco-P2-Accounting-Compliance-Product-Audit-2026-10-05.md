# Acco — P2 Accounting, Compliance & Product-Readiness Audit

Date: 2026-10-05 · Baseline: `feat/mvp-modules` @ **`1f589b56c8a73cc802cdc81dc22ac86ec1977021`** (= current production) · Working tree clean.
Nature: **read-only audit + planning.** No application code was changed. No commit/push/deploy; no VPS/Caddy/MONIX/compose/.env/secrets/production-data touched; no backup branch merged. Findings were produced by code-level investigation and independently spot-verified at the cited lines.

---

## 1. Executive summary

The sacred core is sound: the immutable double-entry ledger, RLS tenant isolation, the append-only hash-chained audit, human-only decisions, and the P0/P1 fixes from the previous pass are all **intact and enforced at the database level** (verified). On top of that solid core, this audit found correctness and compliance gaps that matter before real companies keep books here.

Headline findings:

- **P0 (data integrity): financial writes are not idempotent.** Recording a payment and posting a manual ledger entry carry no idempotency key, and `recordPayment` + bank reconciliation read-then-write across separate transactions with no row lock or per-document uniqueness constraint. A routine double-click, client retry, or two concurrent bank matches **double-posts a settlement to the immutable ledger** (invoice shows double-paid; cash double-moved). Correcting it requires a reversal because the ledger is append-only. This is the single most important item.
- **P1 (materially incorrect books):** (1) the VAT register **excludes ledger reversals** (`reverses_entry_id IS NULL`), so correcting an invoice by reversal leaves the original VAT in the figures with no offset; (2) the EUR-only assumption is **not enforced** — a non-EUR invoice/payment/bank line/manual entry can be created and is then summed 1:1 into EUR reports/VAT with no conversion; (3) Google OAuth **`state` is generated but never validated** (login/account-link CSRF), and that route is outside the auth middleware.
- **P2 (compliance / workflow / readiness):** SAF-T is an internal placeholder shape, not the NRA schema (must not be represented as NRA-ready); VAT return is a 6-cell non-rate-split subset with no reverse-charge / intra-EU-acquisition self-assessment; VAT period is keyed on posting date because **no tax-event date exists**; accounting-period lock is app-layer only with unbounded back/future-dating and unrestricted reopen; invoice issuance / ledger posting / payment reversal have **no confirmation step** before irreversible accounting actions; the authenticated app is ~75% hard-coded Bulgarian so the **EN toggle is misleading**; backend error strings leak verbatim to the UI; several mutating routes are over- or un-permissioned (`POST /companies` has no authz; VAT build/return gated by `VAT_READ`). Production still runs the local storage driver (S3/MinIO move still open).
- **Governance note (owner decision, not a defect):** CLAUDE.md §15 lists credit/debit notes, proforma, bank reconciliation, SAF-T, the AI assistant, and English UI as *DO-NOT-BUILD-in-MVP*, yet all are built. CLAUDE.md §3 names `next-intl`/§4 a `packages/*` layer; the app ships a bespoke dictionary and inlines money utils per module instead. These are scope/architecture decisions to ratify, audited here as the code actually exists.

Counts: **1 P0, 3 P1, 26 P2, 10 P3.** Nothing here reopens the closed P0/P1 security work — those fixes were re-verified intact.

This pass changed no code. The one tiny exception considered (adding a column or guard to make the audit executable) was not needed — the existing local harness already runs.

---

## 2. Verified baseline

- `git status --short`: clean. `git branch --show-current`: `feat/mvp-modules`. `git rev-parse HEAD`: `1f589b56c8a73cc802cdc81dc22ac86ec1977021` — **matches the stated production commit.** No unrelated local changes.
- `git log --oneline -3`: `1f589b5` (security P0/P1) → `0c5a0f1` (typography) → `0d51977` (branding/BG-first).
- Prior reports present: `docs/audits/Acco-P0-P1-Security-Accounting-Audit-2026-10-05.md`, `Acco-Icon-Localization-Audit-Report-2026-10-05.md`.

---

## 3. Architecture / data-flow map (as built)

- **API:** NestJS modular monolith, `apps/api/src/modules/*` each `domain/application/infrastructure/api`. Monorepo reality: `pnpm-workspace.yaml` globs `apps/*` only — the `packages/*` shared layer (money/format/validators) named in CLAUDE.md §4 **does not exist on disk**; money/format utilities are inlined per module.
- **Tenant/authz:** `TenantContextMiddleware` sets tenant from the signed JWT, company only after an assignment check; global `RbacGuard` (`APP_GUARD`) enforces `@RequirePermission`; **a route with no decorator is allowed for any authenticated role** (`rbac.guard.ts:21`). RLS is FORCE on tenant tables and is the enforced backstop.
- **Ledger (single writer):** the only code that writes `journal_entries`/`journal_lines` is `JournalRepository`, reached solely through `LedgerService.postEntry`/`reverseEntry`. **No alternate write path exists** (grep-confirmed). Five callers: manual API, docintel review posting, invoice issue, payments, bank reconciliation (which posts only via payments). DB enforces Σdebit=Σcredit (deferred constraint), ≥2 lines, amount>0, immutability (UPDATE/DELETE/TRUNCATE blocked), one-reversal-per-original, RLS.
- **Accounting data flow:** document → extraction → review (human confirms account/VAT/**posting date**) → `PostingService` → `LedgerService` → ledger. Invoices: draft → issue (gapless number + PDF + ledger post). Payments: outstanding → `recordPayment` → ledger. Banking: statement import (hash-deduped) → match → `recordPayment`. Reports/VAT/SAF-T read from the ledger (+ masterdata/invoices/payments for some read-models).
- **Account roles:** `account_mappings` (role→account) with canonical BG-chart fallback (`masterdata/domain/account-mapping.ts`); migration 0040 seeds the chart per company. Writers resolve accounts via `getPostingAccounts()` (role-based, good). **The VAT register classifier is the exception — it hard-codes `4531/4532/401/411`.**

---

## 4. Previously deferred P2/P3 — current status

From the P0/P1 report §16 and §R2.6, verified at HEAD:

| Prior item | Status now | Evidence |
|---|---|---|
| Move production to S3/MinIO storage driver | **STILL OPEN** | `docker-compose.deploy.yml:108,153` `STORAGE_DRIVER: local` (so the signed-URL fix remains the live doc path — correct that it was fixed) |
| Derive journal currency from `companies.base_currency` (F) | **STILL OPEN / worse than thought** | `base_currency` read only by `tenancy/…/company.repository.ts` and `saft/…/saft.repository.ts`; no accounting path reads it → CUR-1/CUR-2 |
| Make VAT register accounts configurable (G) | **STILL OPEN** | `tax/domain/vat/calculator.ts:3-5` literals; classifier not driven by mappings → VAT-5 |
| Unify `JWT_SECRET`/`AUTH_JWT_SECRET`, drop dev fallback | **STILL OPEN (latent, masked)** | `token.service.ts:13` dev fallback; `config/env.schema.ts:6,13` requires only `JWT_SECRET`; shipped configs map both → SEC-5 |
| Google OAuth `state`; fail-closed malware scan | **OAuth state STILL OPEN**; malware scan is effectively fail-closed | `auth.controller.ts:54-60` (state unvalidated) → SEC-1; docs stay `scanning` without a real verdict (OK) |
| Password reset, MFA enrolment UI, per-route auth throttle, off-host backups | **STILL OPEN (P3)** | no change this pass |
| Posting-date (E) | **CLOSED** (R2) | confirmed-date flow in place and tested |

---

## 5. Accounting-correctness findings

(Currency, chart, posting invariants, periods. VAT in §7, invoices §8, payments §9, reports §10, SAF-T §11.)

**Currency**
- **CUR-1 (P1, CODE DEFECT):** EUR-only is a convention, not an invariant. Invoice `currency` is a free-form optional string with no validation (`invoicing/api/dto/*`), payments and bank accounts default EUR but accept others, the manual ledger DTO accepts any `^[A-Z]{3}$`. Reporting (`reporting/domain/reports/calculator.ts`) and the VAT classifier sum amounts **with no currency field/filter at all**, so any non-EUR entry is summed 1:1 into EUR trial balance / P&L / balance sheet / VAT — silently wrong. Recommended MVP behaviour: *enforce* `currency == company base currency (EUR)` at invoice-draft, payment, bank-account creation and manual post; do not add FX.
- **CUR-2 (P2, PRODUCT DECISION):** `companies.base_currency` / `company_settings.default_currency` exist but are **never read** by ledger/invoicing/payments/tax/reporting. Decide whether base currency should be authoritative (it is currently dead weight).
- Money is exact decimal on the posting and reporting paths (integer cents; `numeric(20,2)`); the only float-money is the VAT register arithmetic (`Number(l.amount)` mitigated by `round2`) — **VAT-6 (P3)**.

**Chart of accounts**
- Hard-coded codes `602/4531/401/702/4532/411/503` + `STD20` are the **intentional Bulgarian default chart**, seeded by 0040 and resolvable through `account_mappings` with a safe fallback; **writers read the mappings, not literals** (good). No retained-earnings/opening-balance account exists (see REP-2).
- **VAT-5 (P2, latent CODE DEFECT):** the VAT register **classifier** is not configurable — `tax/domain/vat/calculator.ts:3-5` hard-codes `4531/4532/401/411`. If a company remaps those VAT/control roles via the account-mappings UI (nothing prevents it), posting uses the mapped codes but the VAT register/return silently misclassifies or drops the entries. The code even documents the coupling (`account-mapping.ts:20-28`). Fix: forbid remapping the VAT/control roles, or drive the classifier from `getPostingAccounts()`.

**Posting invariants** (full matrix verified — all core invariants hold at the DB for every path)
- **POST-0 / P0:** idempotency — see §9 (PAY cluster) and the P0 row in §15. Manual ledger post (`ledger.controller.ts`) and `recordPayment` have no idempotency key; review-posting, invoice-issue and reconcile each have their own guard but reconcile's is racy.
- **POST-2 (P2, CODE DEFECT):** module-level audit rows for review/invoice/payment postings are written in a **separate transaction after** the ledger commit (`posting.service.ts`, `invoice.service.ts`, `payment.service.ts`). The ledger's own `EntryPosted` audit is atomic, but a crash between the two leaves a posted entry without its module audit row (CLAUDE.md §8 wants one txn).
- **POST-3 (P2, CODE DEFECT):** invoice posting resolves account code→id via `invoice.repository.ts accountIdByCode` which does **not** check `is_postable` (docintel and payments repos do). A header/deactivated account could be posted to.

**Accounting periods**
- **PER-1 (P2, PRODUCT/LEGAL):** back-dating and future-dating are **unbounded** — the gate only blocks months explicitly locked; any never-locked month (the default) accepts postings with no lower or upper bound.
- **PER-2 (P2, CODE DEFECT):** period lock is **application-layer only** (0030 explicitly ships no DB trigger), and `assertOpen` runs in its own transaction separate from the posting insert (TOCTOU). A raw write or a lock set between check and insert is not caught.
- **PER-3 (P2, PRODUCT/LEGAL):** a locked period can be **reopened** freely by any `PERIOD_MANAGE` holder; there is no terminal "filed" state, so a period whose VAT return was generated can be reopened and re-posted.
- Covered well: every ledger-affecting path does reach `assertOpen`; lock/unlock require `PERIOD_MANAGE` + human; reversal asserts both the original and today's period.

---

## 6. Security regression findings

**Prior P0/P1 fixes — all intact (re-verified):** ledger RBAC on every route + global guard + viewer withheld; validated ledger DTOs + global ValidationPipe; signed-URL verifier rejects unsigned/forged/expired/non-string/duplicate-param and the adapter refuses traversal/NUL/backslash; tenant middleware rejects no-principal and sets company only after assignment check, RLS unchanged; dev seed fail-closed and not run by deploy.

**New findings (financial/state-changing route enumeration):**

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| SEC-1 | **P1** | Google OAuth `state` generated but **never validated**; callback reads only `code`/`error`; route is outside the auth middleware → login/account-link CSRF | `auth.controller.ts:54-60` |
| SEC-2 | P2 | `POST /companies` has **no `@RequirePermission`** → any authenticated `member` can create a company and is auto-assigned owner (within their own tenant; no cross-tenant break) | `tenancy/api/tenancy.controller.ts:14` |
| SEC-3 | P2 | VAT `POST build` and `POST return` are state-producing but gated only by **`VAT_READ`** (every role, incl. viewer, holds it); the dedicated `VAT_SUBMIT` permission is defined but unused | `tax/api/vat.controller.ts:11,23`; `identity/domain/roles.ts` |
| SEC-4 | P2 | `POST documents/:id/scan-result` gated by `DOCUMENT_UPLOAD` (the uploader's own perm) → a user can self-attest `{result:'clean'}` to force their doc out of quarantine | `docintel/api/documents.controller.ts:23`; `document.service.ts:131-137` |
| SEC-5 | P2 | `AUTH_JWT_SECRET` not in the fail-fast env required/production-secret lists; `token.service.ts` has a `'dev-only-not-for-prod'` fallback (masked in shipped configs, latent) | `token.service.ts:13`; `config/env.schema.ts:6,13` |
| SEC-6 | P3 | Only a global 300/min throttle; no stricter per-route limit on `/auth/login` | `app.module.ts` throttler |
| BANK-authz (G9) | P2 | `confirm-match`/`manual-match` require only `BANK_RECONCILE`; they post settlements via `recordPayment` without re-checking `PAYMENT_RECORD` (period + human gates still hold) | `banking/api/banking.controller.ts:41-51`; `reconciliation.service.ts:83` |

No new unauthenticated or cross-tenant exposure was found; the middleware exclude list contains only reads and pre-auth POSTs.

---

## 7. VAT findings

| ID | Sev | Status | Finding | Evidence |
|---|---|---|---|---|
| VAT-1 | **P1** | CODE DEFECT | Register **excludes ledger reversals** (`reverses_entry_id IS NULL`), so an invoice corrected by reversal leaves its original VAT in the register with no offset; only credit-note *documents* are netted | `tax/infrastructure/vat.repository.ts:27` |
| VAT-2 | P2 | CODE DEFECT / LEGAL | No tax-event date (данъчно събитие) anywhere; `journal_entries` has only `posting_date`, and the register is keyed on it → VAT period = bookkeeping date, not chargeability date | `0004_ledger.up.sql:41`; `vat.repository.ts:26-28` |
| VAT-3 | P2 | NOT IMPL / LEGAL | Reverse charge (чл.117 self-assessment) and intra-EU acquisitions are enum/suggestion-valid but the register builder can never produce them and no paired output+input VAT is generated | `tax/domain/vat/calculator.ts:37-44` |
| VAT-4 | P2 | PARTIAL / LEGAL | Return dataset is a 6-cell subset (11/30/40/50/60/80); all sales base lumped into cell 11, purchases into 30; no rate split, no intra-EU/RC cells | `calculator.ts:52-60`; `0013_vat.up.sql:58` |
| VAT-5 | P2 | latent DEFECT | Classifier hard-codes `4531/4532/401/411` (not configurable); remapping VAT/control roles silently breaks the register | `calculator.ts:3-5,20-34` |
| VAT-6 | P3 | DEFECT (minor) | VAT register math is JS-float `Number()` (mitigated by `round2`) — contradicts "exact decimal" | `calculator.ts:16-17,37-49` |
| VAT-rates | P3 | LEGAL | Rates are free-form (not constrained to {20,9,0}); not effective-dated | `0007_masterdata.up.sql:52`; `0014_invoicing.up.sql:62` |

Implemented correctly: per-line/per-document rounding; credit/debit note sign-netting *when issued as documents*; VIES number validation (cache-first, EU proxy configurable) and the outbound VIES recapitulative dataset.

---

## 8. Invoice findings (CODE FACTS)

- Numbering is **gapless, concurrency-safe and immutable**: per `(company, kind, series, year)` row-locked `UPDATE … RETURNING`, allocate+markIssued in one txn, DB uniqueness, and a trigger (`deny_when_issued`) blocks any change to an issued number/amount except the one-time journal link. Verified sound.
- **INV-1 (P2, CODE DEFECT/workflow):** `issueInvoice` consumes the number + flips to issued in one txn, then posts to the ledger in a *separate* txn; if posting fails, the number is legally consumed but `journal_entry_id` stays null — an **issued-but-unposted** document (not a numbering gap, but a ledger hole until retried). `invoice.service.ts:155-207`.
- Format `2026-0001` (4-digit, year-reset, Cyrillic prefixes for notes) is a **LEGAL question** (§14), not a code defect.

---

## 9. Payments / banking findings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **PAY-1** | **P0** | No idempotency on `recordPayment` / manual ledger post; a retry/double-click double-posts a settlement + journal entry | `payments/api/payments.controller.ts:16`; `payment.service.ts`; `ledger.service.ts:28` |
| **PAY-2** | **P0** | Double settlement via cross-txn TOCTOU: outstanding read and payment insert are different txns, no row lock, **no per-document uniqueness** in 0029 | `payment.service.ts:52-93`; `0029_payments.up.sql` |
| **BANK-1** | **P0** | Reconciliation race + unconditional `markReconciled` (no `WHERE status='unreconciled'`): concurrent/retried matches post duplicate settlements for one bank line | `reconciliation.service.ts:69-95`; `banking.repository.ts:96-98` |
| PAY-3 | P1 | Ledger entry commits before the payment row; on partial failure the cash movement exists with no payment linkage → invoice re-payable + ledger/AR divergence | `payment.service.ts:85` vs `88-93` |
| G7 | P3 | 6-field import dedupe can silently drop a genuinely identical real transaction (value_date not in key) | `banking/domain/normalize.ts:105-108` |

PAY-1/PAY-2/BANK-1 are one fix theme (idempotency + locking) → the **P0**. Sound as built: overpayment arithmetic, partial/multiple payments, reversal correctness (period gate via ledger), and cross-import duplicate-file dedupe (hash + unique index).

---

## 10. Reporting findings

- Core statements (trial balance, GL, journal, P&L, balance sheet, monthly, cash flow) **derive from the authoritative ledger**; trial balance balances by integer-cents construction; report snapshots are WORM + sha256. Good.
- **REP-1 (P2, PRODUCT DECISION):** AR/AP **aging** derives from the `invoices`/`payments` read-models, **not** from the 411/401 control accounts, so a manual journal touching 411/401 makes aging disagree with the ledger. `reports.controller.ts:43-47`; `payments.repository.ts:134-177`.
- **REP-2 (P2/P3, PRODUCT DECISION):** balance-sheet equity is a single lump (current result + prior retained earnings); no year-end closing entry or retained-earnings account.
- **REP-3 (P3):** CSV export only for the three management reports; BOM correctly prepended for Cyrillic.

---

## 11. SAF-T findings

- Sourced correctly from ledger + masterdata + invoices + payments in one snapshot txn. XML builder is deterministic given a fixed dataset; artifacts are append-only + sha256 + WORM; XML export is **off by default in prod** (`SAFT_XML_ENABLED` unset → sync dataset-only path).
- **SAFT-1 (P2, LEGAL — compliance-blocking):** the XML is an **internal placeholder shape** (`urn:saft:bg:shaped:v2`, "Placeholder namespace … bound in Phase 4"); no NRA XSD ships or is bound (`SAFT_XSD_PATH` unset → validator inert, returns `{ok:null}`); required-field rules are empty; StandardTaxCode/CustomerSupplier code-mapping tables ship empty. **Must not be represented as NRA-ready.**
- **SAFT-2 (P2):** not byte-reproducible on re-export (`AuditFileDateCreated=generatedAt`; period not pinned/locked, so new postings change the dataset). WORM is applied even when XSD is inert (`xsd.ok !== false` with `ok===null`).
- **SAFT-3 (P3):** duplicate-export race (no unique on company/period/active); per-job claim is atomic but two export ids can exist for one period.

---

## 12. Product / UX findings

Cross-cutting positives: consistent loading/empty/error states (shared `EmptyState`/`ErrorState`/`TableSkeleton`), coherent status badges (draft/reviewed/approved/posted/issued/paid), global 401→login handling, responsive shell with a mobile drawer. The recently added **posting-date confirmation** on `review/[id]` is the best irreversible-action guard (required, disabled-until-confirmed, server fail-closed).

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| UX-1 | P2 | **Invoice issuance has no confirmation** — one click assigns a legal gapless number, posts to the ledger and generates a PDF (irreversible) | `invoices/page.tsx:93` |
| UX-2 | P2 | Ledger **post**/**approve** have no confirmation modal summarizing the entry before it hits the immutable ledger (disabled-until-valid is good but not a confirm) | `review/[id]/page.tsx:317,341` |
| UX-5 | P2 | Reject-review uses a **hard-coded reason with no input** → weak audit trail | `review/[id]/page.tsx:102` |
| UX-6 | P2 | Dashboard / VAT / reports / posting default to **hard-coded mid-2026 period constants** → a real user sees a stale "current period" | `dashboard/page.tsx:26-27`; `vat/page.tsx:21`; `reports/page.tsx:26`; `posting/page.tsx:18-19` |
| UX-3 | P3 | Payment reversal fires on one click with a hard-coded reason | `payment-dialog.tsx:144` |
| UX-4 | P3 | Period lock fires on one click (unlock available) | `accounting-periods-tab.tsx:91` |
| UX-7 | P3 | Wide data tables (invoices/banking/reports/posting; raw `<table>` in posting) may overflow on phones with no horizontal scroll | `posting/page.tsx:63` + shared `Table` |

---

## 13. Localization findings

- Mechanism is good and BG-default: `lib/i18n` dictionary with `useT()`/`useLang()`, `bg`→`key` fallback, EN toggle in topbar + settings. **The BG/EN dictionary is complete.**
- **L10N-1 (P2):** only ~4 of ~21 authenticated pages actually call `useT()`; ~**75% of screen copy is hard-coded Bulgarian** (even `review/[id]` has 83 Cyrillic literal lines and uses `t()` only for pipeline/state). `catalog` is bilingual via its *own* inline helper (a third pattern). Net: **flipping to EN leaves most of the app in Bulgarian** — the EN toggle is misleading. Coverage ≈ 20% wired / 75% hard-coded BG / 5% ad-hoc.
- **L10N-2 (P2):** backend error strings leak verbatim — every mutation shows `toast.error('Грешка', {description: e.message})` where `e.message` is the raw backend envelope (class-validator arrays joined). English NestJS/validator messages surface untranslated into the BG UI; there is no `code→localized string` mapping. `client.ts:91-93`.

**Proposed i18n strategy (options, not a mandate):**
- **A — Honest BG-only (≈0.5 day):** hide/feature-flag the EN toggle (CLAUDE.md §15 lists English UI as out-of-MVP); keep the dictionary. Removes the "EN looks broken" problem immediately.
- **B — Wire the existing dictionary page-by-page (≈4–6 days, recommended if EN is wanted):** no new infrastructure; add `useT()` per page, move literals into the existing namespaces, extend `bg`+`en` where missing. Incremental and low-risk.
- **C — Centralize error localization (≈1 day, add to A or B):** one `useApiErrorToast()` mapping backend `code`→`errors.<key>` with `e.message` fallback.
- Keep the catalog at `lib/i18n/dictionaries.ts`; only `errors.*` is worth hoisting to a shared `packages/i18n` if api↔web sharing is wanted.

---

## 14. Legal / compliance gap register

**C = requires verification against Bulgarian/EU requirements by an appropriate expert; do not convert to a coding task until the requirement is established.** (A = code defect, tracked in the tables above; B = product decision.)

| # | Category | Question to verify | Depends-on finding |
|---|---|---|---|
| L1 | C | Must VAT register inclusion / СД period assignment use the **tax-event date** (данъчно събитие / изискуемост), not the posting date? If yes, VAT-2 is non-compliant and a tax-event-date field is required. | VAT-2 |
| L2 | C | Must the СД по ЗДДС split base by **rate and transaction type** (20/9/0/exempt/intra-EU/RC)? Are the omitted cells legally required? | VAT-4 |
| L3 | C | Are **reverse charge** (чл.82/84/117) and **intra-community acquisitions** required to be self-assessed (paired output+input, protocol) and shown in both registers? | VAT-3 |
| L4 | C | Must correction of an issued invoice be via **credit/debit note** (not a bookkeeping reversal)? Bears on whether VAT-1 can occur in a compliant workflow. | VAT-1 |
| L5 | C | Is a 30-day VIES cache acceptable evidence of a counterparty's VAT-registered status for zero-rating at the tax-event date? | VAT (VIES) |
| L6 | C | Does ЗДДС/ППЗДДС require invoice numbers to be a **10-digit, continuous, non-resetting** sequence without year/alpha prefixes? If yes, the current format is non-compliant. | §8 |
| L7 | C | May credit/debit notes carry their **own prefixed series**, or must they draw from the same continuous invoice range? | §8 |
| L8 | C | Is an **issued-but-unposted** document (INV-1) acceptable, and what remediation is required? | INV-1 |
| L9 | C | Is a hard bound on **back/future-dating** required beyond discretionary locking? | PER-1 |
| L10 | C | After a VAT return is generated/filed, may the period be **reopened**? Is a terminal "filed" state required? | PER-3 |
| L11 | C | Is **application-only** period-lock enforcement (no DB backstop) acceptable? | PER-2 |
| L12 | C | **SAF-T:** the official НАП SAF-T **XSD/namespace, mandatory fields, and standard code mappings** must be obtained and bound before any NRA claim. | SAFT-1 |
| L13 | C | **Document/audit retention** periods (invoices, SAF-T, audit trail, backups) required by BG law — confirm the WORM retention (3650 days) and 14-day backup window meet them. | infra |
| L14 | B | Ratify the CLAUDE.md §15 scope: credit/debit notes, proforma, bank reconciliation, SAF-T, AI assistant, English UI are built despite being DO-NOT-BUILD-in-MVP. | governance |

---

## 15. P0 / P1 / P2 / P3 table

Every row: ID · severity · evidence · workflow · consequence · fix · migration? · data-transform? · scope · tests.

### P0 (1) — data integrity

| ID | Finding / evidence | Consequence | Fix | Migration? | Data transform? | Scope | Tests |
|---|---|---|---|---|---|---|---|
| **P0-1** | Non-idempotent financial writes + reconcile race (PAY-1/PAY-2/BANK-1/PAY-3): `payment.service.ts:52-93`, `reconciliation.service.ts:69-95`, `banking.repository.ts:96-98`, `0029_payments.up.sql` (no uniqueness), `ledger.service.ts:28` | A double-click/retry or concurrent bank match **double-posts a settlement** to the immutable ledger; invoice double-paid, ledger/AR diverge; only correctable by reversal | Idempotency key on `recordPayment` + manual ledger post (dedupe table or unique key); `SELECT … FOR UPDATE` on the document/txn during settlement; guard `markReconciled` with `WHERE reconciliation_status='unreconciled'`; make reconcile post + mark atomic | **Yes** (idempotency key column/table; partial unique or lock) — additive | No | ~2–3 d | concurrency double-submit, retry replay, concurrent bank match, reversal still correct, debit=credit |

### P1 (3) — materially incorrect books / security

| ID | Finding | Consequence | Fix | Mig? | Data? | Scope | Tests |
|---|---|---|---|---|---|---|---|
| VAT-1 | Register excludes ledger reversals (`vat.repository.ts:27`) | Reversal-based correction leaves original VAT uncorrected | Include reversal + reversed-original as a signed pair, or require corrections via credit-note documents (confirm L4 first) | No | No (re-derivable read-model) | ~1–2 d | reversal nets to zero in register; credit-note still nets |
| CUR-1 | EUR-only not enforced; reports/VAT sum non-EUR 1:1 (`invoicing dto`, `reporting/.../calculator.ts`) | A non-EUR amount silently corrupts aggregates | Validate `currency == base currency (EUR)` at invoice/payment/bank-account/manual-post; reject otherwise (no FX) | No | No | ~1 d | reject non-EUR invoice/payment/manual; all-EUR unaffected |
| SEC-1 | OAuth `state` unvalidated; route outside middleware (`auth.controller.ts:54-60`) | Login/account-link CSRF | Persist + verify `state` (and nonce); honor `email_verified` | No | No | ~0.5–1 d | state mismatch rejected; happy path works |

### P2 (26) — compliance / workflow / readiness

Grouped (full evidence in §5–§13): **VAT** VAT-2, VAT-3, VAT-4, VAT-5 · **Currency** CUR-2 · **Periods** PER-1, PER-2, PER-3 · **Invoices** INV-1 · **Posting** POST-2, POST-3 · **Security** SEC-2, SEC-3, SEC-4, SEC-5, BANK-authz · **Reports** REP-1, REP-2 · **SAF-T** SAFT-1, SAFT-2 · **UX** UX-1, UX-2, UX-5, UX-6 · **L10N** L10N-1, L10N-2 · **Infra** storage-driver→S3/MinIO. (Migrations: VAT-2 needs a tax-event-date column if L1 confirms; PER-1/PER-2 may add a DB period backstop; otherwise mostly code/UI. No data transforms required.)

### P3 (10)

VAT-6, VAT-rates(effective-dating), G7(dedupe edge), SEC-6(login throttle), REP-3(CSV scope), SAFT-3(export race), UX-3, UX-4, UX-7, next-intl/`packages/*` governance alignment.

---

## 16. Test coverage & gaps

**Existing (strong where it counts):** 54 jest suites / 418 tests + real-DB e2e (MVP workflow 14/14, posting-date 4/4, SAF-T 17/17). Good coverage of: RLS isolation, ledger balance/immutability/reversal, posting-date fail-closed, ledger RBAC + DTO validation, signed-URL/traversal, dev-seed guard, period lock on the confirmed date, VIES, SAF-T pipeline.

**Highest-value missing tests (protect invariants, not volume):**
1. **Idempotency / double-settlement (P0-1):** concurrent + retried `recordPayment` and bank `confirm-match` must not double-post; `markReconciled` single-fire.
2. **VAT register with reversals (VAT-1):** an invoice reversed must net to zero in the register/return.
3. **Currency enforcement (CUR-1):** non-EUR invoice/payment/manual-post rejected; mixed-currency entry refused.
4. **Period bounds (PER-1):** back/future-dated posting policy (once a rule is decided).
5. **VAT classifier vs remapped accounts (VAT-5):** remapping a VAT role is refused, or the register follows the mapping.
6. **Invoice issue atomicity (INV-1):** a posting failure must not leave an issued-but-unposted invoice (or must be recoverable deterministically).
7. **OAuth state (SEC-1):** callback with mismatched/absent state rejected.
8. **Authz regressions:** `POST /companies` requires COMPANY_CREATE; VAT build/return require the write permission.
9. **VAT rounding + credit/debit note sign** golden cases across 20/9/0 (extend beyond standard rate).
10. **AR/AP aging vs ledger control accounts (REP-1):** reconciliation assertion.

---

## 17. Recommended implementation passes (small, independently testable/deployable)

- **Pass 1 — Financial-write integrity + quick authz (P0 + SEC):** idempotency keys + settlement locking + `markReconciled` guard (P0-1); OAuth `state` (SEC-1); `POST /companies` permission (SEC-2); VAT build/return → `VAT_SUBMIT` (SEC-3); scan-result restricted to the worker (SEC-4); `AUTH_JWT_SECRET` in env validation (SEC-5). Migration: additive idempotency. **Highest priority.**
- **Pass 2 — Currency + core correctness:** enforce EUR == base currency (CUR-1); VAT register reversal handling (VAT-1, pending L4); VAT classifier configurability / remap guard (VAT-5); invoice issue atomicity (INV-1); `is_postable` on invoice post (POST-3); atomic module audit (POST-2).
- **Pass 3 — Period & report integrity:** period back/future bounds + optional DB backstop + terminal "filed" state (PER-1/2/3, pending L9–L11); AR/AP aging reconciled to control accounts (REP-1).
- **Pass 4 — Product workflow UX:** confirmation steps before irreversible actions (invoice issue, ledger post/approve, payment reversal, period lock — UX-1/2/3/4); reject-reason input (UX-5); dynamic current period (UX-6); table overflow on mobile (UX-7).
- **Pass 5 — Localization:** choose i18n option A or B (§13); centralize error localization (L10N-2).
- **Pass 6 — VAT/SAF-T compliance (gated on legal answers L1–L13):** tax-event date (VAT-2), rate-split return + reverse-charge/intra-EU (VAT-3/4), bind the real NRA SAF-T XSD + code mappings + reproducibility (SAFT-1/2). **Do not start until the legal register is answered.**
- **Ongoing:** move production to the S3/MinIO driver (presigned URLs) when convenient.

Each pass is independently deployable; Pass 1 should ship first and alone.

---

## 18. Deployment / migration implications

- Audit pass: **no deployment, no migration, no data change** — report only.
- Future passes: **Pass 1** adds an additive idempotency column/table (metadata-only, online-safe) and is code-otherwise; **Pass 2/3** are mostly code; a **tax-event-date column** (if L1 confirms) and a **period DB backstop** (if chosen) are additive migrations with no backfill of invented dates. No pass requires transforming existing accounting data. Reports/VAT read-models re-derive from the ledger, so their fixes need no data migration.
- Production currently runs `STORAGE_DRIVER=local`, so the signed-URL fix remains the live document-serving control until the S3/MinIO move.

---

## 19. Decisions / questions for the owner

1. **Scope ratification (L14):** credit/debit notes, proforma, bank reconciliation, SAF-T, the AI assistant, and English UI are built despite CLAUDE.md §15 listing them as out-of-MVP. Keep, or gate behind flags? This affects how much of §7–§13 is "must-fix now" vs "later".
2. **Currency model (CUR-1/CUR-2):** confirm EUR-only is the intended MVP model so we enforce it (recommended), and decide whether `companies.base_currency` becomes authoritative.
3. **Correction policy (L4/VAT-1):** are invoice corrections done by credit/debit note only, or also by ledger reversal? Determines the VAT-1 fix shape.
4. **Legal register L1–L13:** who verifies the Bulgarian/EU requirements (tax-event date, СД cell split, reverse charge/intra-EU, invoice numbering format, back-dating bounds, period reopen, SAF-T XSD, retention)? Pass 6 is blocked on these.
5. **SAF-T positioning:** confirm we will not represent SAF-T as NRA-ready until the official schema is bound; keep XML export off in prod until then.
6. **i18n direction (§13):** honest BG-only now (hide EN) or invest ~4–6 days to wire real EN?
7. **RBAC design (SEC-3, BANK-authz):** should VAT build/return require `VAT_SUBMIT`, and should bank reconcile require `PAYMENT_RECORD` in addition to `BANK_RECONCILE`?

---

### Appendix — report metadata
Investigation was fanned out to five read-only sub-audits (currency/chart/posting-invariants; VAT/invoicing/periods; payments/banking/reports/SAF-T; security-regression/route-enumeration; product-UX/localization) and their findings independently spot-verified at the cited lines. No application code was modified in this pass.
