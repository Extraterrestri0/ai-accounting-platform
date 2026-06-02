# AI Accounting Platform — Complete Domain Model & Database Architecture

**Document type:** Domain model & data architecture (conceptual/logical — no SQL, DDL, or code)
**Builds on:** *Master Architecture*, *UX Architecture*, *Design System*, *Screen Specifications* (all v1.0)
**Audience:** Architects, backend leads, data engineers, compliance
**Status:** v1.0 — domain & data baseline

---

## How to read this document

- This is a **logical/conceptual** model. Entities are described by **attributes in plain language** and **relationships in cardinality notation** — never as SQL or DDL.
- Every entity is specified with the five required dimensions: **Purpose · Ownership · Relationships · Lifecycle · State transitions** (entities with no meaningful states are marked *reference/immutable*).
- **ERD notation:** `A (1) ──< (N) B` = one A has many B; `A (N) >──< (N) B` = many-to-many (via a join entity, named); `◆` = aggregate root; `⊕` = append-only/immutable; `⏱` = effective-dated; `�yer` PII = contains personal data (GDPR-relevant).
- Sections follow the requested 1–27 order. Cross-cutting rules that apply to *all* entities are stated once in **Modeling Conventions** below and not repeated per entity.

---

## Modeling Conventions (apply to every entity)

1. **Tenancy scoping.** Every entity carries `tenant_id`; company-scoped entities also carry `company_id`. These are the isolation keys (Section 19). No entity is global except platform reference data (currencies, country codes, base CoA templates, SAF-T schema versions).
2. **Immutable accounting core.** Posted ledger data (`JournalEntry`, `JournalLine`, VAT register lines, signed submissions) is **append-only ⊕**. Corrections are made by *reversing/adjusting* entries, never by editing or deleting. This is the central invariant of the whole system.
3. **Effective-dating ⏱.** Reference data that changes over time (VAT rates, a company's VAT registration, exchange rates, account validity) is versioned with `valid_from`/`valid_to`, never overwritten. Treatment is always resolved "as of" a document/posting date.
4. **Soft vs hard delete.** Operational drafts may be soft-deleted (`deleted_at`); anything posted, signed, or filed is **never deleted** (retention/legal). Hard deletion exists only for GDPR erasure within statutory limits (Section 24/27).
5. **Auditability.** Every state change emits an `AuditEvent` (Section 17) and, where relevant, a `DomainEvent` (Section 22). The **actor may be a human or the AI** (modeled as a non-human principal).
6. **Currency.** Functional currency is **EUR**; **BGN is a legacy currency**; the **redenomination boundary is 1 Jan 2026**; the **fixed rate 1 EUR = 1.95583 BGN** is stored as an immutable `ExchangeRate`. Monetary values store amount + currency + (for legacy/foreign) the EUR-equivalent and rate used.
7. **Identity & keys.** Surrogate identifiers for all entities; natural keys (EIK, VAT number, invoice number) are attributes with their own uniqueness/validation rules, not primary keys.
8. **Money representation.** Amounts are exact decimal (minor-unit precision), never floating point; each monetary attribute names its currency and, where converted, its rate and source.

---

## 1. Core Business Domains

The platform decomposes into nine business domains. Each owns its data and exposes it to others through events and well-defined contracts.

| # | Domain | Responsibility | Core question it answers |
|---|--------|----------------|--------------------------|
| D1 | **Identity & Access** | Tenants, users, roles, permissions, sessions | Who is acting, and what may they do? |
| D2 | **Tenant & Organization** | Accounts, firms, companies, subscriptions, entitlements | Whose data is this and what's the plan? |
| D3 | **Master Data** | Counterparties, products, bank accounts, fiscal calendar, chart of accounts, tax codes | The stable facts everything references |
| D4 | **Document & Intelligence** | Documents, OCR extractions, classification, AI suggestions, learning, review queue | Capturing and understanding inputs |
| D5 | **Sales & Invoicing** | Invoices, credit/debit notes, proforma, payments, receivables | What we billed and are owed |
| D6 | **Accounting / Ledger** | Journal entries, general ledger, balances, trial balance, periods | The system of record (double-entry) |
| D7 | **Tax & Compliance** | VAT periods/ledgers/returns, VIES, NAP submissions, SAF-T, KEP signatures, obligations | What the state requires and proof of filing |
| D8 | **Banking** | Bank accounts, statements, transactions, reconciliation | Matching money movement to records |
| D9 | **Platform & Cross-cutting** | Audit trail, domain events, notifications, retention, reporting/projections | Traceability, messaging, history, insight |

**Domain dependency direction (high level):** D1/D2 underpin everything → D3 master data is referenced by D4–D8 → D4 (intelligence) proposes into D5/D6 → D6 (ledger) is the source of truth read by D7 (tax) and D9 (reporting) → D8 (banking) reconciles against D5/D6 → D9 observes all.

---

## 2. Bounded Contexts

Domains map to **bounded contexts** (DDD). Each has its own model; integration is explicit. A modular monolith hosts them now, decomposable later along these seams.

| Bounded Context | Aggregate roots ◆ | Owns |
|-----------------|-------------------|------|
| **Identity** | User ◆, Role ◆ | Authentication, sessions, MFA, permission definitions |
| **Tenancy** | Tenant ◆, Organization ◆, Company ◆, Subscription ◆ | Multi-tenant structure, firm/company hierarchy, billing/entitlements |
| **MasterData** | Counterparty ◆, Product ◆, BankAccount ◆, ChartOfAccounts ◆, FiscalYear ◆, TaxCode ◆ | Reference/master records |
| **DocumentIntelligence** | Document ◆, Extraction ◆, AISuggestion ◆ | Capture, OCR, extraction, learning, review items |
| **Invoicing** | SalesDocument ◆ | Sales documents, lines, payments, receivables |
| **Ledger** | JournalEntry ◆, AccountingPeriod ◆ | Postings, balances, period control |
| **Tax** | VatReturn ◆, VatPeriod ◆ | VAT registers/returns, VIES, validation |
| **Compliance** | NapSubmission ◆, Signature ◆, Certificate ◆, SafTExport ◆ | State filings, signatures, obligations |
| **Banking** | BankStatement ◆, ReconciliationSession ◆ | Statements, transactions, matches |
| **Reporting** | ReportRun ◆ (read models) | Projections, snapshots, dashboards |
| **AuditAndEvents** | AuditEvent ⊕, DomainEvent ⊕ | Append-only trail, event store/outbox |
| **Notification** | Notification ◆ | Alerts, deadlines, channels |

### 2.1 Context map (integration relationships)

```
            ┌──────────┐        ┌────────────┐
            │ Identity │        │  Tenancy   │  (shared kernel:
            └────┬─────┘        └─────┬──────┘   tenant_id, company_id)
                 │  upstream          │
        ┌────────┴────────────────────┴─────────────────────┐
        │                 MasterData (reference)              │
        └──┬──────────┬───────────┬───────────┬──────────────┘
           │          │           │           │
  ┌────────▼───┐ ┌────▼─────┐ ┌───▼────┐ ┌────▼──────┐
  │ DocIntel   │→│ Invoicing │→│ Ledger │←│  Banking  │
  │ (proposes) │ │           │ │ (truth)│ │(reconcile)│
  └────────────┘ └───────────┘ └───┬────┘ └───────────┘
                                    │ read-only
                            ┌───────▼────────┐
                            │      Tax       │→ Compliance (NAP/KEP/SAF-T)
                            └───────┬────────┘   via Anti-Corruption Layer
                                    │             to external NRA/QTSP/VIES
                    ┌───────────────▼───────────────┐
                    │  Reporting (projections)        │
                    └─────────────────────────────────┘
   AuditAndEvents + Notification observe ALL contexts (publish/subscribe).
```

**Integration patterns:**
- **Shared kernel:** `tenant_id` / `company_id` scoping and money/currency value objects are shared by all contexts.
- **DocIntel → Invoicing/Ledger:** *Customer/Supplier–Supplier* (supplier of suggestions); DocIntel proposes, Ledger/Invoicing accept — a one-way, human-gated handoff.
- **Ledger as upstream truth:** Tax and Reporting are **conformist/downstream** read-only consumers of the ledger (they never write postings).
- **External systems (NRA/НАП, QTSP/KEP, banks, VIES):** wrapped by **Anti-Corruption Layers (ACLs)** in the Compliance/Banking/MasterData contexts so volatile external schemas (e.g. SAF-T versions) never leak into the core model.
- **Eventing:** all contexts publish `DomainEvent`s; Audit, Notification, Reporting subscribe (Section 22).

---

## 3. Entity Relationship Architecture (overview)

### 3.1 The spine of the model

```
Tenant ◆
  └──< Organization ──< Company ◆ ──< FiscalYear ──< AccountingPeriod
                          │
   ┌──────────────────────┼───────────────────────────────────────────┐
   │                       │                                           │
Counterparty          ChartOfAccounts ──< Account ⏱        BankAccount
   │ (cust/supp)            │                                  │
SalesDocument ──< Line   JournalEntry ◆ ⊕ ──< JournalLine ⊕   BankStatement
   │                       │  (Dr/Cr to Account)               │ ──< BankTransaction
Payment ─< Allocation     LedgerBalance (projection)           ReconciliationMatch
   │                       │
Document ◆ ──< Version   VatPeriod ──< VatLedgerEntry ⊕ ──> VatReturn ◆
   │ ──< Extraction          │                                  │
   │ ──< AISuggestion        │                              NapSubmission ◆ ──< Artifact
ReviewItem                 ViesDeclaration                      │ ──> Confirmation
                                                            Signature (KEP) ── Certificate

User ◆ >──< Company (CompanyAssignment: role)    AuditEvent ⊕   DomainEvent ⊕   Notification
```

### 3.2 Universal relationships
- **Everything company-scoped** belongs to exactly one `Company`, which belongs to one `Tenant`. This chain is the security boundary.
- **Source-to-record lineage:** `Document → Extraction → AISuggestion → (accepted) → JournalEntry / SalesDocument`. Every posting can be traced back to its originating document; every document forward to its postings.
- **Ledger centrality:** `JournalEntry`/`JournalLine` are the hub; `SalesDocument`, `BankTransaction` (via reconciliation), and `VatLedgerEntry` all relate to postings; `LedgerBalance`, `TrialBalance`, `VatReturn`, and reports are **derived** from them.
- **Append-only pairs:** `AuditEvent` and `DomainEvent` reference (but are never referenced-for-mutation by) domain entities.

### 3.3 Key cross-entity invariants
- **Double-entry:** for any `JournalEntry`, Σ(debit `JournalLine`) = Σ(credit `JournalLine`) in functional currency.
- **Period integrity:** no posting into a `locked` `AccountingPeriod`; VAT period cannot be filed twice.
- **Lineage integrity:** a posted `JournalEntry` derived from a `Document` pins the `Extraction`/`AISuggestion` version used.
- **Tenant isolation:** no relationship ever crosses `tenant_id` (enforced at the data layer, Section 19).
- **Effective-dating:** VAT treatment on a line resolves the `TaxCode`/rate valid on the document date; currency conversion pins the `ExchangeRate` used.

The following sections (4–21) detail the entities within each area; Sections 22–27 cover cross-cutting data architecture.

---

## 4. Accounting Data Model

The accounting context is the system of record. Its entities are deliberately conservative and append-only.

**AccountingPeriod**
- Purpose: a discrete reporting window (monthly aligned to VAT) within a fiscal year; the unit of period control and locking.
- Ownership: company-scoped; owned by Ledger context; created from `FiscalYear` calendar.
- Relationships: `FiscalYear (1) ──< (N) AccountingPeriod`; `AccountingPeriod (1) ──< (N) JournalEntry` (by posting date); referenced by `VatPeriod`.
- Lifecycle: generated for the fiscal calendar → `future` → `open` → `soft-closed` (review) → `locked` (after filing) → `reopened` (controlled, audited, rare).
- State transitions: `future → open → soft-closed → locked`; `locked → reopened → open` only by Approver with audit + reason. Postings allowed only in `open`/`soft-closed`.

**FiscalYear**
- Purpose: the company's accounting year (start month configurable); groups periods; basis (NSS/IFRS) selection.
- Ownership: company-scoped; MasterData/Ledger.
- Relationships: `Company (1) ──< (N) FiscalYear ──< (N) AccountingPeriod`; defines opening balances carried from prior year.
- Lifecycle: `draft → active → closed` (year-end) → `archived`.
- State transitions: `active → closed` triggers opening-balance carry-forward; `closed` years are read-only.

**LedgerBalance** (projection)
- Purpose: running and period balances per account — a **derived read model** maintained from journal lines (so the system never sums all history live).
- Ownership: company-scoped; Ledger (Reporting projection).
- Relationships: `Account (1) ──< (N) LedgerBalance` (per period); rebuilt from `JournalLine ⊕`.
- Lifecycle: continuously projected on posting events; snapshotted per period close.
- State transitions: *reference/derived* (no business states; versioned by period).

**OpeningBalance**
- Purpose: starting balances for an account at fiscal-year/period start (incl. **migration balances**, and the **BGN→EUR redenomination boundary at 1 Jan 2026**).
- Ownership: company-scoped; Ledger.
- Relationships: `Account (1) ──< (N) OpeningBalance` (per fiscal year); produced by year-end carry-forward or data migration.
- Lifecycle: `provisional (migration) → confirmed → locked`.
- State transitions: locked once the period opens; changes require audited adjustment.

ERD:
```
Company ──< FiscalYear ──< AccountingPeriod ──< JournalEntry ⊕
Account  ──< LedgerBalance (per period)   Account ──< OpeningBalance (per FY)
```

---

## 5. General Ledger Data Model

**Account** ⏱
- Purpose: a single account in the chart (Bulgarian national CoA, classes 1–7); the dimension every posting hits.
- Ownership: company-scoped (instantiated from a CoA template); MasterData.
- Relationships: `ChartOfAccounts (1) ──< (N) Account`; `Account (1) ──< (N) JournalLine`; self-referencing `parent_account` for the class/sub-account tree; mapped to VAT/SAF-T codes.
- Key attributes (conceptual): code, name (localized), class (1–7), type (asset/liability/equity/revenue/expense), normal balance (Dr/Cr), parent, active flag, effective-dated validity, SAF-T mapping, allow-manual-posting flag.
- Lifecycle: `active → inactive` (never hard-deleted if used).
- State transitions: `active ⇄ inactive`; cannot deactivate with open balance; cannot delete if referenced by any line.

**GeneralLedger** (logical view)
- Purpose: not a stored table but the **logical aggregation** of all `JournalLine`s per account over time, surfaced via `LedgerBalance` + line drill-down.
- Ownership: Ledger; derived.
- Relationships: composes `Account` + `JournalLine` + `LedgerBalance`.
- Lifecycle/transitions: *derived view*.

**TrialBalance** (snapshot)
- Purpose: point-in-time Dr/Cr totals per account proving the books balance; supports comparatives across the EUR/BGN changeover.
- Ownership: company-scoped; Reporting projection.
- Relationships: aggregates `LedgerBalance` as of a date; references `AccountingPeriod`.
- Lifecycle: generated on demand and snapshotted at period close (immutable snapshot for audit).
- State transitions: snapshot = *immutable*; live view = *derived*.

ERD:
```
ChartOfAccounts ──< Account ⏱ ──< JournalLine ⊕ ──(rolled up)──> LedgerBalance ──> TrialBalance(snapshot)
```

---

## 6. Journal Entry Architecture

The atomic unit of the system of record; strictly append-only and double-entry.

**JournalEntry** ◆ ⊕
- Purpose: a balanced set of debit/credit lines representing one economic event (posting).
- Ownership: company-scoped; Ledger context; aggregate root over its lines.
- Relationships: `AccountingPeriod (1) ──< (N) JournalEntry`; `JournalEntry (1) ──< (2..N) JournalLine`; optional links to `SourceDocument` (`Document`), `SalesDocument`, `BankTransaction`, `AISuggestion` (the accepted proposal), and `reverses → JournalEntry` (for reversals).
- Key attributes: entry number (sequential), posting date, description, source type (AI/manual/import/system), source reference, currency + EUR-equivalent + rate, status, created-by actor (human/AI), approved-by.
- Lifecycle: `draft → pending-approval → posted → (reversed)`. Auto-posted high-confidence entries skip directly to `posted` (still audited, reversible).
- State transitions:
  - `draft → pending-approval` (submitted)
  - `pending-approval → posted` (approved; **balance invariant enforced** Σdr=Σcr)
  - `posted → reversed` (a new reversing `JournalEntry` is created; the original is never mutated)
  - `draft → voided` (discard before posting)
  - No transition allows editing a `posted` entry — corrections are new entries.

**JournalLine** ⊕
- Purpose: a single debit or credit to one account; carries VAT/analytic dimensions.
- Ownership: part of the `JournalEntry` aggregate; never exists independently.
- Relationships: `JournalEntry (1) ──< (N) JournalLine`; `Account (1) ──< (N) JournalLine`; optional `TaxCode`, `Counterparty`, cost-center/analytic dimensions, `VatLedgerEntry` linkage.
- Key attributes: account, side (Dr/Cr), amount (functional + original currency), VAT code, counterparty, dimension tags, narrative.
- Lifecycle: created and posted with its parent; immutable thereafter.
- State transitions: *immutable* (mirrors parent).

**PostingRule / EntryTemplate**
- Purpose: reusable mapping (supplier/category → accounts + VAT) used by the AI engine and manual templates; the substrate the learning loop refines.
- Ownership: company-scoped (and per-counterparty); DocIntel/Ledger.
- Relationships: referenced by `AISuggestion`; produces `JournalEntry` drafts; learns from `AIFeedback`.
- Lifecycle: `learned/draft → active → superseded` (versioned).
- State transitions: new versions supersede old; never destructive (history kept for explainability).

ERD:
```
AccountingPeriod ──< JournalEntry ◆⊕ ──< JournalLine ⊕ ──> Account
JournalEntry ──reverses──> JournalEntry        JournalEntry ──source──> Document/SalesDocument/BankTransaction/AISuggestion
PostingRule ──informs──> AISuggestion ──accepted──> JournalEntry
```

---

## 7. Chart of Accounts Architecture

**ChartOfAccounts** ◆
- Purpose: the structured set of accounts a company uses; instantiated from a jurisdiction template (Bulgarian national CoA), with NSS/IFRS basis.
- Ownership: company-scoped; MasterData; aggregate root over its accounts.
- Relationships: `Company (1) ──< (1) ChartOfAccounts ──< (N) Account`; derived from `ChartOfAccountsTemplate` (platform reference).
- Lifecycle: `instantiated (from template) → active → versioned (on structural change)`.
- State transitions: structural changes create a new version; active accounts can't be removed if used.

**ChartOfAccountsTemplate** (platform reference)
- Purpose: master Bulgarian national CoA (classes 1–7) and future jurisdiction templates; the seed for each company's CoA.
- Ownership: platform-global (not tenant-scoped); MasterData.
- Relationships: `Template (1) ──< (N) TemplateAccount`; copied into `ChartOfAccounts` on company creation.
- Lifecycle: versioned by the platform (regulatory updates).
- State transitions: *reference*; companies opt into new versions deliberately.

**AccountMapping**
- Purpose: maps each `Account` to external schemas — **SAF-T** taxonomy, VAT return boxes, report line items — isolating the core from volatile external formats (ACL).
- Ownership: company-scoped (defaults from template); MasterData/Compliance.
- Relationships: `Account (1) ──< (N) AccountMapping` (per target schema + version).
- Lifecycle: `default → customized → revalidated on schema change ⏱`.
- State transitions: versioned with the target schema; never breaks historical exports.

ERD:
```
ChartOfAccountsTemplate ──(instantiate)──> ChartOfAccounts ◆ ──< Account ⏱
Account ──< AccountMapping ──> {SAF-T taxonomy | VAT boxes | report lines} (versioned)
```

---

## 8. VAT Architecture

VAT data is **derived from approved postings**, never entered separately. Rates and treatments are effective-dated reference data.

**TaxCode / VatTreatment** ⏱
- Purpose: the VAT treatment applied to a line — Standard 20%, Reduced 9%, Zero, Exempt, Reverse-charge, Intra-EU — with effective-dated rates.
- Ownership: platform reference (Bulgarian rates) + company overrides; MasterData/Tax.
- Relationships: `TaxCode (1) ──< (N) JournalLine`/`InvoiceLine`/`VatLedgerEntry`; resolved as-of document date.
- Lifecycle: `effective → superseded` (rate change creates a new version).
- State transitions: *effective-dated reference*; never overwritten.

**CompanyVatRegistration** ⏱ ʸPII-adjacent
- Purpose: a company's VAT status over time (registered/not/in-process), VAT number, registration dates; drives all treatment logic.
- Ownership: company-scoped; MasterData/Tax.
- Relationships: `Company (1) ──< (N) CompanyVatRegistration` (history); informs default `TaxCode` selection.
- Lifecycle: `pending → active → deregistered`, each version effective-dated.
- State transitions: status changes append a new effective record; historical postings keep the status valid on their date.

**VatPeriod**
- Purpose: the VAT reporting window (monthly, filing by the 14th) aggregating registers and the return.
- Ownership: company-scoped; Tax.
- Relationships: aligns to `AccountingPeriod`; `VatPeriod (1) ──< (N) VatLedgerEntry`; `VatPeriod (1) ──< (1) VatReturn` (+ `ViesDeclaration`).
- Lifecycle: `open → assembling → validated → filed → locked`.
- State transitions: `open → assembling → validated → filed → locked`; cannot file with blocking validation issues; locked on successful filing.

**VatLedgerEntry** ⊕ (purchase/sales register line)
- Purpose: a line in the purchase ledger (дневник на покупките) or sales ledger (дневник на продажбите), derived from a posted document/entry.
- Ownership: company-scoped; Tax; append-only.
- Relationships: `VatPeriod (1) ──< (N) VatLedgerEntry`; `JournalLine`/`SalesDocument` ──> `VatLedgerEntry`; carries `TaxCode`, counterparty VAT no., net/VAT/total.
- Lifecycle: created on posting → included in period → frozen at filing.
- State transitions: `provisional → included → filed (immutable)`; corrections via period adjustments.

**VatReturn** ◆
- Purpose: the periodic VAT declaration (справка-декларация) summarizing the registers into return boxes; the filable artifact.
- Ownership: company-scoped; Tax; aggregate root.
- Relationships: `VatPeriod (1) ──< (1) VatReturn`; aggregates `VatLedgerEntry`; ──> `NapSubmission`; signed via `Signature`.
- Lifecycle: `draft → validated → approved → signed → filed → locked → (corrected)`.
- State transitions: gated stepper (validate→approve→sign→submit); `filed → corrected` creates a correction return; never edited in place.

**ViesDeclaration**
- Purpose: intra-EU recapitulative statement for cross-border supplies.
- Ownership: company-scoped; Tax.
- Relationships: `VatPeriod (1) ──< (0..1) ViesDeclaration`; aggregates intra-EU `VatLedgerEntry`; validated against VIES via ACL.
- Lifecycle/transitions: mirrors `VatReturn`.

**VatValidationIssue**
- Purpose: a detected pre-filing problem (missing VAT, duplicate, RC inconsistency, VIES mismatch).
- Ownership: company-scoped; Tax (often AI-flagged).
- Relationships: links to the offending `VatLedgerEntry`/`Counterparty`; blocks `VatReturn` advance if severity = error.
- Lifecycle: `open → resolved | dismissed(reason)`.
- State transitions: `open → resolved` (fixed at source) / `open → dismissed` (with reason, audited).

ERD:
```
CompanyVatRegistration ⏱ ─┐
TaxCode ⏱ ────────────────┼─> VatLedgerEntry ⊕ ──< VatPeriod ──> VatReturn ◆ ──> NapSubmission
                          │                         └──> ViesDeclaration
JournalLine/SalesDocument ┘     VatValidationIssue ──flags──> VatLedgerEntry
```

---

## 9. NAP Submission Architecture

Wraps the volatile external NRA channel behind an ACL; everything is append-only and KEP-signed.

**NapSubmission** ◆
- Purpose: a single filing to the NRA (VAT return, VIES, future SAF-T) — its lifecycle, artifacts, and confirmation.
- Ownership: company-scoped; Compliance; aggregate root.
- Relationships: `VatReturn`/`ViesDeclaration`/`SafTExport (1) ──< (1) NapSubmission`; `NapSubmission (1) ──< (N) SubmissionArtifact`; `(1) ──< (0..1) SubmissionConfirmation`; references `Signature`.
- Lifecycle: `prepared → validated → approved → signed → submitted → confirmed | failed`.
- State transitions:
  - `prepared → validated → approved → signed → submitted`
  - `submitted → confirmed` (NRA acceptance stored) or `submitted → failed` (retains signed artifacts; retry allowed)
  - **Idempotent:** a submission cannot be duplicated for the same period/type once confirmed.

**SubmissionArtifact** ⊕
- Purpose: the exact file(s) generated and submitted (NAP-compliant file, SAF-T XML), with hash; immutable evidence.
- Ownership: part of `NapSubmission` aggregate; Compliance.
- Relationships: `NapSubmission (1) ──< (N) SubmissionArtifact`; referenced by `Signature` (what was signed).
- Lifecycle: `generated → signed → submitted` (immutable).
- State transitions: *immutable* once generated.

**SubmissionConfirmation** ⊕
- Purpose: the NRA's acceptance receipt/reference; proof of filing.
- Ownership: part of `NapSubmission`; Compliance.
- Relationships: `NapSubmission (1) ──< (0..1) SubmissionConfirmation`.
- Lifecycle: created on acceptance; immutable.
- State transitions: *immutable*.

**SafTExport** ◆ (Phase 2)
- Purpose: a SAF-T file (monthly/annual/on-request) mapped to the **versioned NRA schema**, validated and signed.
- Ownership: company-scoped; Compliance.
- Relationships: built from `JournalEntry`/master data via `AccountMapping`; references `SafTSchemaVersion`; ──> `NapSubmission`.
- Lifecycle: `mapped → validated → signed → submitted`.
- State transitions: as `NapSubmission`; **schema version pinned** at generation.

**SafTSchemaVersion** (platform reference, ACL)
- Purpose: a versioned definition of the NRA SAF-T format/validation rules (changes 2025–2026), isolating the core from format churn.
- Ownership: platform-global; Compliance.
- Relationships: `SafTSchemaVersion (1) ──< (N) SafTExport`.
- Lifecycle: `published → active → deprecated` (effective-dated).
- State transitions: *reference*; old exports always reference the version they used.

**ComplianceObligation / Deadline**
- Purpose: a known filing obligation and its due date (VAT 14th, SAF-T cadence, annual), driving deadlines and notifications.
- Ownership: company-scoped (firm-aggregated); Compliance.
- Relationships: derived from `CompanyVatRegistration` + jurisdiction rules; ──> `Notification`, firm deadline calendar.
- Lifecycle: `upcoming → due → met | missed`.
- State transitions: `upcoming → due → met` (on confirmed submission) / `due → missed` (escalates).

ERD:
```
VatReturn/ViesDeclaration/SafTExport ──> NapSubmission ◆ ──< SubmissionArtifact ⊕ ──signed──> Signature
                                              └──< SubmissionConfirmation ⊕
SafTExport ──pins──> SafTSchemaVersion (platform)      ComplianceObligation ──> Notification
```

---

## 10. KEP Signature Architecture

Qualified e-signatures under eIDAS; the platform never holds private keys.

**Certificate** ʸPII
- Purpose: a registered qualified certificate (holder, provider/QTSP, validity) usable for signing/auth.
- Ownership: tenant/user-scoped; Compliance.
- Relationships: `User (1) ──< (N) Certificate`; `Certificate (1) ──< (N) Signature`; provider via ACL (B-Trust/Evrotrust/StampIT…).
- Lifecycle: `registered → active → expiring → expired | revoked`.
- State transitions: `active → expiring → expired`; `active → revoked`; expired/revoked cannot sign (checked at signing time).

**Signature** ⊕
- Purpose: an immutable record of a signing event over a specific artifact (hash), with signer, certificate, timestamp.
- Ownership: company/tenant-scoped; Compliance; append-only.
- Relationships: `Signature (N) >── (1) Certificate`; `Signature (1) ── (1) SignedArtifact` (a `SubmissionArtifact`/`Document`); referenced by `NapSubmission`, `VatReturn`, audit.
- Key attributes: artifact reference + hash, signer identity, certificate snapshot, method (cloud/token/mobile), qualified timestamp, verification result.
- Lifecycle: `initiated → authenticated → applied → verified | failed | cancelled`.
- State transitions: progresses through signing phases; only a `verified` signature is recorded as valid; partial/failed never count as signed; once `verified` it is *immutable*.

**SigningSession** (transient)
- Purpose: the in-flight signing workflow state (method, provider, phase), not the final record.
- Ownership: ephemeral, user/session-scoped; Compliance.
- Relationships: produces a `Signature` on success.
- Lifecycle: `prepare → authenticate → apply → verify`, then discarded (only the resulting `Signature` persists).
- State transitions: transient; failure/timeout/cancel ends without producing a `Signature`.

ERD:
```
User ──< Certificate (provider via ACL) ──< Signature ⊕ ──signs──> SubmissionArtifact/Document
SigningSession (transient) ──produces──> Signature
```

---

## 11. AI Learning Architecture

The intelligence that learns from corrections — scoped strictly per company/counterparty, never crossing tenants.

**AISuggestion** ◆
- Purpose: a proposal from the AI — extraction interpretation, journal coding, VAT treatment, or risk flag — with confidence and reasoning.
- Ownership: company-scoped; DocIntel; aggregate root for a proposal.
- Relationships: `Document`/`Extraction (1) ──< (N) AISuggestion`; `AISuggestion ──accepted──> JournalEntry/SalesDocument`; `(1) ──< (N) AIFeedback`; references `PostingRule`/model version.
- Key attributes: type (coding/VAT/risk/duplicate), proposed payload, confidence score, reasoning/evidence, model + prompt version, validation results.
- Lifecycle: `proposed → presented → accepted | corrected | rejected | superseded`.
- State transitions: `proposed → presented`; `presented → accepted` (becomes a posting), `→ corrected` (human edits → feedback), `→ rejected` (with reason), `→ superseded` (re-run). Immutable record kept for explainability/audit.

**AIFeedback** ⊕
- Purpose: the structured signal from a human accepting/correcting/rejecting a suggestion — the training input.
- Ownership: company-scoped (and per-counterparty); DocIntel; append-only.
- Relationships: `AISuggestion (1) ──< (N) AIFeedback`; aggregated into `PostingRule`/`CompanyLearningProfile`.
- Lifecycle: created on each human decision; immutable.
- State transitions: *immutable*.

**CompanyLearningProfile**
- Purpose: the accumulated, **tenant-isolated** learned preferences for a company (how it codes suppliers, typical treatments) — the memory that improves suggestions without leaking across tenants.
- Ownership: company-scoped; DocIntel.
- Relationships: built from `AIFeedback`; consulted by the suggestion engine; references `Counterparty`-level patterns.
- Lifecycle: continuously updated (versioned snapshots).
- State transitions: *versioned/derived*; never shared across `tenant_id`.

**ModelVersion / PromptVersion** (platform reference)
- Purpose: tracks which AI model/prompt produced a suggestion (for evaluation, rollback, reproducibility).
- Ownership: platform-global; DocIntel.
- Relationships: `ModelVersion (1) ──< (N) AISuggestion`.
- Lifecycle: `candidate → active → retired` (gated by evaluation against a labeled set).
- State transitions: promotion/rollback controlled; suggestions always pin the version used.

**Anomaly / RiskFlag**
- Purpose: a detected outlier or risk (unusual amount, period mismatch, VAT inconsistency) surfaced to the Recommendations Center.
- Ownership: company-scoped; DocIntel.
- Relationships: references the subject (`Document`/`JournalEntry`/`VatLedgerEntry`); ──> `Notification`/Recommendations feed.
- Lifecycle: `raised → acknowledged → resolved | dismissed`.
- State transitions: `raised → acknowledged → resolved`/`dismissed(reason)` (feeds learning).

ERD:
```
Extraction ──< AISuggestion ◆ ──accepted──> JournalEntry/SalesDocument
AISuggestion ──< AIFeedback ⊕ ──aggregates──> CompanyLearningProfile (tenant-isolated)
ModelVersion ──pins──> AISuggestion        Anomaly/RiskFlag ──> Recommendations/Notification
```

---

## 12. Document Management Architecture

Originals are immutable; everything derived links back to them (lineage).

**Document** ◆ ʸPII
- Purpose: any captured or generated artifact (supplier invoice, receipt, bank statement, contract, generated invoice PDF) and its metadata.
- Ownership: company-scoped; DocIntel; aggregate root over versions/extractions.
- Relationships: `Company (1) ──< (N) Document`; `Document (1) ──< (N) DocumentVersion`; `(1) ──< (N) Extraction`; `(1) ──< (N) AISuggestion`; linked to resulting `JournalEntry`/`SalesDocument`; `source` (upload/email/portal/generated); optional `Counterparty`.
- Key attributes: type, source channel, status, original-file reference (object storage), MIME/format (PDF/JPG/PNG/TIFF/XML/ZIP), page count, content hash (dedup), tags, retention class.
- Lifecycle: `received → scanned (malware) → classified → extracted → in-review → posted/archived | rejected | duplicate`.
- State transitions: pipeline progression; `in-review → posted` (accepted) or `→ rejected`; `→ duplicate` (linked to original); archived documents retained per policy; **original bytes never change** (edits create new versions/derived data).

**DocumentVersion** ⊕
- Purpose: an immutable snapshot of the document's stored representation/derived data at a point (e.g. re-OCR, enhancement, edited extraction set).
- Ownership: part of `Document` aggregate; DocIntel.
- Relationships: `Document (1) ──< (N) DocumentVersion`; references the storage object + extraction snapshot.
- Lifecycle: appended on change; never deleted (history).
- State transitions: *immutable*.

**DocumentInbox / IngestionItem**
- Purpose: an incoming, not-yet-triaged item (email-in attachment, portal upload) before it becomes a `Document`.
- Ownership: company-scoped; DocIntel.
- Relationships: `IngestionItem ──becomes──> Document`; source metadata (email sender, portal user).
- Lifecycle: `received → matched/created | merged | discarded`.
- State transitions: triage to a `Document` or discard (audited).

**StorageObject** (logical)
- Purpose: the binary blob in EU object storage referenced by documents/artifacts (not a relational entity but modeled for lineage and retention).
- Ownership: company-scoped; Platform.
- Relationships: referenced by `Document`/`DocumentVersion`/`SubmissionArtifact`; encrypted at rest; lifecycle/tiering by retention class.
- Lifecycle: `hot → cold/archive → (eligible for deletion per retention)`.
- State transitions: tier transitions; deletion only when retention + legal hold allow.

ERD:
```
IngestionItem ──becomes──> Document ◆ ──< DocumentVersion ⊕ ──> StorageObject (EU, encrypted)
Document ──< Extraction ──< ExtractedField ;  Document ──< AISuggestion ──> JournalEntry/SalesDocument
```

---

## 13. OCR Extraction Architecture

Structured data derived from documents, with confidence and deterministic validation.

**Extraction** ◆
- Purpose: the structured result of reading one document (one run of the pipeline), holding all extracted fields and overall confidence.
- Ownership: company-scoped; DocIntel; aggregate root over fields.
- Relationships: `Document (1) ──< (N) Extraction` (re-runs create new ones); `Extraction (1) ──< (N) ExtractedField`; references `ClassificationResult`, `ModelVersion`; feeds `AISuggestion`.
- Key attributes: method (OCR vs native XML parse), overall confidence, validation summary, model/engine version, run timestamp.
- Lifecycle: `running → completed | failed`; `completed → superseded` (on re-run).
- State transitions: `running → completed`/`failed`; latest completed extraction is the active one; prior ones retained for audit.

**ExtractedField**
- Purpose: one extracted datum (supplier, VAT no., EIK, invoice no., date, net, VAT, total, currency, IBAN, description) with its confidence and source location.
- Ownership: part of `Extraction`; DocIntel.
- Relationships: `Extraction (1) ──< (N) ExtractedField`; corrected values produce `AIFeedback`.
- Key attributes: field name, raw value, normalized value, confidence, bounding-box/location (for highlight), validation state.
- Lifecycle: `extracted → validated → confirmed | corrected`.
- State transitions: `extracted → validated` (deterministic checks), `validated → confirmed`/`corrected` (human) — corrections feed learning.

**ClassificationResult**
- Purpose: the document-type classification (purchase invoice / sales invoice / receipt / statement / contract) driving the pipeline path.
- Ownership: part of `Extraction`; DocIntel.
- Relationships: `Document/Extraction (1) ──< (1) ClassificationResult`.
- Lifecycle: produced early in the pipeline; correctable by human.
- State transitions: `predicted → confirmed | corrected`.

**ValidationCheck**
- Purpose: a deterministic verification over extracted data (EIK checksum, VAT/VIES, IBAN, net+VAT=total, duplicate) — trusted over the model.
- Ownership: company-scoped; DocIntel/Tax.
- Relationships: `Extraction (1) ──< (N) ValidationCheck`; failures can become `VatValidationIssue`/`Anomaly`.
- Lifecycle: `run → passed | failed | warning`.
- State transitions: re-run on edit; blocking failures gate acceptance.

**DuplicateCandidate**
- Purpose: a detected potential duplicate (content fingerprint + fuzzy match on supplier/number/amount/date).
- Ownership: company-scoped; DocIntel.
- Relationships: links two `Document`s; surfaced in review.
- Lifecycle: `flagged → confirmed-duplicate | dismissed-distinct`.
- State transitions: resolution required before posting; confirmed duplicate links to the original and is not posted.

ERD:
```
Document ──< Extraction ◆ ──< ExtractedField (confidence, location)
Extraction ──< ClassificationResult ;  Extraction ──< ValidationCheck ──> VatValidationIssue/Anomaly
Document ──< DuplicateCandidate ──> Document
```

---

## 14. Invoice Architecture

Sales documents (invoice/credit/debit/proforma) share one model with type-specific rules; only invoices/notes post to the ledger.

**SalesDocument** ◆
- Purpose: a customer-facing sales document; type determines numbering, VAT logic, and whether it posts.
- Ownership: company-scoped; Invoicing; aggregate root over lines.
- Relationships: `Company (1) ──< (N) SalesDocument`; `Counterparty (customer) (1) ──< (N) SalesDocument`; `(1) ──< (N) InvoiceLine`; `NumberingSeries (1) ──< (N) SalesDocument`; credit/debit notes reference an original (`SalesDocument ──references──> SalesDocument`); posts to `JournalEntry`; creates `Receivable`; produces a `Document` (PDF).
- Key attributes: type (invoice/credit/debit/proforma), number (sequential per series), issue/supply/due dates, customer snapshot, currency + EUR/BGN, totals, language, status, reason (notes).
- Lifecycle: `draft → issued → sent → (paid | partially-paid | overdue) → (credited)`; proforma: `draft → issued → converted | expired`.
- State transitions:
  - `draft → issued` (sequential number assigned; **mandatory fields validated**; posts to ledger except proforma)
  - `issued → sent` (emailed)
  - `sent → partially-paid → paid` (payment allocations) / `→ overdue` (due date passed)
  - `issued/sent → credited` (a credit note references it)
  - proforma `issued → converted` (becomes a real invoice) — proforma never posts.

**InvoiceLine**
- Purpose: a billed item/service with quantity, price, and VAT treatment.
- Ownership: part of `SalesDocument` aggregate; Invoicing.
- Relationships: `SalesDocument (1) ──< (N) InvoiceLine`; `Product (0..1) ──< (N) InvoiceLine`; `TaxCode (1) ──< (N) InvoiceLine`.
- Lifecycle: created/edited while parent is `draft`; frozen on issue.
- State transitions: *immutable after issue* (mirrors parent).

**NumberingSeries**
- Purpose: enforces sequential, gapless numbering per document type/series (legal requirement).
- Ownership: company-scoped; Invoicing.
- Relationships: `NumberingSeries (1) ──< (N) SalesDocument`.
- Lifecycle: `active → (archived at year/series change)`.
- State transitions: monotonic counter; gaps flagged; never reused.

**Payment** + **PaymentAllocation**
- Purpose: money received and its allocation across one or more invoices.
- Ownership: company-scoped; Invoicing.
- Relationships: `Payment (1) ──< (N) PaymentAllocation ──> SalesDocument`; `Payment` may link to a reconciled `BankTransaction`.
- Lifecycle: `recorded → allocated → (reconciled)`.
- State transitions: `recorded → allocated` (updates invoice paid status); `→ reconciled` (matched to bank).

**Receivable** (projection)
- Purpose: outstanding balance per customer/invoice; powers aging and dunning.
- Ownership: company-scoped; Invoicing (read model).
- Relationships: derived from `SalesDocument` + `PaymentAllocation`.
- Lifecycle/transitions: *derived*; ages into buckets (0–30/31–60/…).

ERD:
```
NumberingSeries ──< SalesDocument ◆ ──< InvoiceLine ──> Product/TaxCode
SalesDocument ──references──> SalesDocument (credit/debit)   SalesDocument ──posts──> JournalEntry
Payment ──< PaymentAllocation ──> SalesDocument ;  SalesDocument ──derives──> Receivable
```

---

## 15. Bank Reconciliation Architecture

**BankAccount**
- Purpose: a company bank account (IBAN, currency) against which statements import and reconcile.
- Ownership: company-scoped; Banking/MasterData.
- Relationships: `Company (1) ──< (N) BankAccount`; `(1) ──< (N) BankStatement`; mapped to a ledger `Account` (e.g. 503/504).
- Lifecycle: `active → closed`.
- State transitions: `active ⇄ inactive`; closed accounts retained for history.

**BankStatement** ◆
- Purpose: an imported statement file (MT940/CAMT.053/CSV/XLSX) and its transactions for a period.
- Ownership: company-scoped; Banking; aggregate root.
- Relationships: `BankAccount (1) ──< (N) BankStatement`; `(1) ──< (N) BankTransaction`; references source `Document`.
- Key attributes: format, period, opening/closing balance, import timestamp, source-file hash (dedup).
- Lifecycle: `imported → parsed → reconciling → reconciled`.
- State transitions: `imported → parsed` (format detected/mapped); `parsed → reconciling → reconciled` (all transactions matched/closed); duplicate-import blocked by hash.

**BankTransaction** ⊕
- Purpose: a single line on a statement (date, amount, direction, counterparty text).
- Ownership: part of `BankStatement` aggregate; Banking.
- Relationships: `BankStatement (1) ──< (N) BankTransaction`; `(1) ──< (0..N) ReconciliationMatch`.
- Lifecycle: `unmatched → matched | partially-matched | reconciled | excluded`.
- State transitions: `unmatched → matched` (to invoice/entry) → `reconciled`; `→ partially-matched` (splits); `→ excluded` (fees/non-business with note).

**ReconciliationSession** ◆
- Purpose: a working context for reconciling an account/period; tracks progress and auto-match runs.
- Ownership: company-scoped; Banking; aggregate root.
- Relationships: spans `BankTransaction`s and candidate `ReconciliationMatch`es; reports progress (N of M).
- Lifecycle: `open → in-progress → completed`.
- State transitions: `open → in-progress → completed` when the period is fully reconciled.

**ReconciliationMatch**
- Purpose: the link between a bank transaction and an invoice/payment/journal entry, with confidence; supports partials/fees/FX.
- Ownership: company-scoped; Banking.
- Relationships: `BankTransaction (1) ──< (N) ReconciliationMatch ──> SalesDocument/Payment/JournalEntry`.
- Key attributes: match confidence, matched amount (for partials), fee/FX components, method (auto/manual).
- Lifecycle: `suggested → accepted | rejected → (undone)`.
- State transitions: `suggested → accepted` (reconciles, may create an adjusting entry) / `→ rejected`; `accepted → undone` (audited reversal).

ERD:
```
BankAccount ──< BankStatement ◆ ──< BankTransaction ⊕ ──< ReconciliationMatch ──> SalesDocument/Payment/JournalEntry
ReconciliationSession ◆ ──tracks──> BankTransaction (progress N of M)
BankAccount ──maps──> Account (ledger)
```

---

## 16. Reporting Architecture

Reporting is **read-only** and built on projections (CQRS-style), never on live aggregation of the full ledger.

**ReportDefinition**
- Purpose: a parameterized report template (P&L, balance sheet, cash flow, VAT summary, aging, management/custom).
- Ownership: platform reference + company-custom; Reporting.
- Relationships: `ReportDefinition (1) ──< (N) ReportRun`; references `Account`/`AccountMapping` (report-line mapping), dimensions.
- Lifecycle: `published → versioned`; custom: `draft → active`.
- State transitions: *reference/versioned*.

**ReportRun / ReportSnapshot** ⊕
- Purpose: a generated instance of a report for parameters (period, compare, language) — snapshotted for audit/sharing.
- Ownership: company-scoped; Reporting.
- Relationships: `ReportDefinition (1) ──< (N) ReportRun`; reads `LedgerBalance`/`TrialBalance`/`VatLedgerEntry` projections; may be shared to Client Portal.
- Lifecycle: `requested → generating → ready | failed`; ready snapshots are immutable.
- State transitions: `requested → generating → ready`/`failed`; shared snapshots are immutable evidence.

**ReadModel / Projection** (derived)
- Purpose: denormalized, query-optimized views maintained from domain events — `LedgerBalance`, `TrialBalanceSnapshot`, `Receivable`/`Payable` aging, dashboard KPIs, firm cross-client rollups.
- Ownership: company/firm-scoped; Reporting.
- Relationships: subscribe to `DomainEvent`s from Ledger/Invoicing/Banking/Tax.
- Lifecycle: continuously updated; rebuildable from the event log.
- State transitions: *derived*; rebuilt on demand (resilience).

**FirmRollup** (projection)
- Purpose: cross-company aggregates for the firm dashboard (clients at risk, deadlines, doc volume, team workload).
- Ownership: tenant(firm)-scoped; Reporting.
- Relationships: aggregates per-company projections within the firm tenant only.
- Lifecycle/transitions: *derived*; respects tenant isolation.

ERD:
```
DomainEvent ⊕ ──feeds──> ReadModel/Projection ──> ReportRun ⊕ (from ReportDefinition)
LedgerBalance / TrialBalance / Receivable / FirmRollup  = projections (rebuildable)
```

---

## 17. Audit Trail Architecture

The audit trail is a first-class, tamper-evident system of evidence.

**AuditEvent** ⊕ (append-only, hash-chained)
- Purpose: an immutable record of every state change — who/what/when/before→after/why — across all contexts.
- Ownership: company/tenant-scoped; AuditAndEvents; strictly append-only.
- Relationships: references the affected entity (polymorphic: document, entry, return, submission, permission, etc.) and the actor (`User` **or AI principal**); chained to the previous event's hash.
- Key attributes: actor (human/AI/system), action, target entity + id, before/after snapshot (or diff), reason/context, timestamp, **prev-hash + this-hash** (chain), source IP/session where relevant.
- Lifecycle: created on every change; never updated or deleted.
- State transitions: *immutable*; integrity verifiable by recomputing the hash chain.

**ActorIdentity**
- Purpose: a unified principal abstraction so AI and humans are both first-class actors in the trail.
- Ownership: platform; AuditAndEvents.
- Relationships: referenced by `AuditEvent`, `JournalEntry.created_by`, `AISuggestion`, `Signature`.
- Lifecycle: stable identity; AI actors versioned by model.
- State transitions: *reference*.

**AuditChainCheckpoint**
- Purpose: periodic anchors of the hash chain (e.g. per period/day) enabling fast integrity verification and tamper detection.
- Ownership: company-scoped; AuditAndEvents.
- Relationships: summarizes a span of `AuditEvent`s.
- Lifecycle: `created → sealed`.
- State transitions: *immutable once sealed*.

ERD:
```
AuditEvent ⊕ (prev-hash → this-hash chain) ──references──> {any entity} + ActorIdentity(human/AI)
AuditChainCheckpoint ──seals──> span of AuditEvent
```

---

## 18. User & Permission Architecture

RBAC scoped by resource hierarchy, with ABAC conditions for sensitive actions.

**User** ◆ ʸPII
- Purpose: an authenticatable person (staff, owner, accountant, client) with credentials and MFA.
- Ownership: tenant-scoped (a user belongs to one tenant; may be invited across — modeled per tenant); Identity.
- Relationships: `User (N) >──< (N) Company` via `CompanyAssignment`; `User (1) ──< (1) Membership` (tenant role); `(1) ──< (N) Certificate`; `(1) ──< (N) Session`.
- Key attributes: name, email, locale, MFA config, status, last login.
- Lifecycle: `invited → active → disabled → (removed)`.
- State transitions: `invited → active` (accepts + MFA); `active → disabled`; last-admin protection prevents orphaning a tenant.

**Membership** (tenant-scoped role)
- Purpose: a user's tenant-level role (Account Owner, Tenant Admin, Billing Manager, Member).
- Ownership: tenant-scoped; Identity.
- Relationships: `Tenant (1) ──< (N) Membership ──> User`.
- Lifecycle: `active → revoked`.
- State transitions: role change audited; at least one Owner always required.

**CompanyAssignment** (company-scoped role)
- Purpose: a user's role on a specific company (Senior Accountant/Approver, Accountant, Bookkeeper, Reviewer, Client User, Read-only) — the backbone of firm mode.
- Ownership: company-scoped; Identity.
- Relationships: `User (N) >──< (N) Company` (join with `Role`); a user holds different roles on different companies.
- Lifecycle: `assigned → revoked`.
- State transitions: assignment/revocation audited; drives all per-company permission checks.

**Role** + **Permission**
- Purpose: `Role` = named bundle of `Permission`s; `Permission` = an allowed action on a resource type, possibly scoped/conditioned.
- Ownership: platform-defined roles + tenant-custom; Identity.
- Relationships: `Role (N) >──< (N) Permission`; `Role` referenced by `Membership`/`CompanyAssignment`.
- Lifecycle: `defined → active → deprecated`; custom: `draft → active`.
- State transitions: hard-guardrail permissions (state submission needs Approver + KEP; cross-tenant isolation) are **non-overridable** and locked.

**Session**
- Purpose: an authenticated session/device, supporting revocation and MFA freshness for ABAC.
- Ownership: user-scoped; Identity.
- Relationships: `User (1) ──< (N) Session`.
- Lifecycle: `active → expired | revoked`.
- State transitions: `active → revoked` (user/admin); MFA-freshness gates sensitive actions.

**Invitation**
- Purpose: a pending invite to join a tenant/company with a prospective role.
- Ownership: tenant-scoped; Identity.
- Relationships: produces a `User`/`CompanyAssignment` on acceptance.
- Lifecycle: `sent → accepted | expired | revoked`.
- State transitions: single-use; expiry enforced.

ERD:
```
Tenant ──< Membership ──> User ◆ ;  User >──< Company via CompanyAssignment(Role)
Role >──< Permission ;  User ──< Session ;  Invitation ──becomes──> User/CompanyAssignment
```

---

## 19. Multi-Tenant Architecture

**Tenant / Account** ◆
- Purpose: the top-level isolation and billing boundary; owns all data beneath it.
- Ownership: self-owning root; Tenancy.
- Relationships: `Tenant (1) ──< (N) Organization/Company`, `(1) ──< (N) User`, `(1) ──< (1) Subscription`; every company-scoped entity transitively belongs to one tenant.
- Key attributes: type (single-business vs firm), data-residency (EU), status, plan.
- Lifecycle: `provisioned → active → suspended → closed`.
- State transitions: `active → suspended` (billing) → `active`; `→ closed` triggers retention-bound offboarding.

**Isolation model (data architecture).**
- **Shared database, shared schema, row-level isolation** keyed on `tenant_id` (and `company_id`), enforced by **database row-level security** as the last line of defence beneath application checks.
- Every query is tenant-scoped by default; no relationship crosses `tenant_id`; AI learning (`CompanyLearningProfile`) is strictly per-tenant.
- **Promotion path:** a large firm tenant can be migrated to a **dedicated database/residency** without model change (data-access is tenant-aware). Modeled as a `tenant.placement` attribute.
- **Tenant context** is carried on every event, audit record, projection, and storage object.

**Entitlement / UsageMeter** (also Section 20)
- Purpose: per-tenant feature gating and metered consumption (documents processed, AI calls, storage, seats, managed companies).
- Ownership: tenant-scoped; Tenancy/Billing.
- Relationships: `Subscription (1) ──< (N) Entitlement`; `Tenant (1) ──< (N) UsageMeter`.
- Lifecycle: meters accrue per period; reset/roll per plan.
- State transitions: `within-limit → approaching → over-limit (overage)`.

ERD:
```
Tenant ◆ ──< Organization ──< Company (◆) ──< {all company-scoped entities}
Tenant ──< Subscription ──< Entitlement ;  Tenant ──< UsageMeter
RLS key: tenant_id (+ company_id)  enforced at data layer
```

---

## 20. Accounting Firm Architecture

The firm is a tenant that manages many client companies; this section models that overlay.

**Organization (Firm)** ◆
- Purpose: a firm grouping that owns/manages multiple client companies and a staff team.
- Ownership: tenant-scoped (a firm tenant); Tenancy.
- Relationships: `Tenant (1) ──< (1..N) Organization`; `Organization (1) ──< (N) Company` (clients); `(1) ──< (N) User` (staff via Membership); branding/white-label settings.
- Lifecycle: `active → archived`.
- State transitions: standard; archiving requires no managed active companies.

**Company (Client)** ◆
- Purpose: a managed client legal entity (EIK, VAT status, fiscal calendar, CoA, base currency) — the unit accountants work within.
- Ownership: tenant/organization-scoped; Tenancy.
- Relationships: `Organization (1) ──< (N) Company`; `Company` is the scope for the entire accounting model; `User >──< Company` via `CompanyAssignment`.
- Lifecycle: `onboarding → active → suspended → offboarded/archived`.
- State transitions: onboarding completes when EIK/VAT/CoA set; archived clients retained per statutory retention.

**ClientEngagement / Assignment overlay**
- Purpose: which staff serve which client and in what role; SoD policy; workload basis for firm dashboards.
- Ownership: organization-scoped; Identity/Tenancy.
- Relationships: built on `CompanyAssignment`; aggregated into `FirmRollup` (workload, at-risk).
- Lifecycle: `assigned → reassigned → ended`.
- State transitions: reassignment audited; preserves history for liability.

**FirmObligationRollup** (projection)
- Purpose: cross-client deadlines, review backlog, and risk for the firm cockpit.
- Ownership: organization-scoped; Reporting.
- Relationships: aggregates per-company `ComplianceObligation`, review queues, `Anomaly`s — **within the firm tenant only**.
- Lifecycle/transitions: *derived*.

ERD:
```
Tenant(firm) ──< Organization ◆ ──< Company(client) ◆ ──< {accounting model}
User(staff) >──< Company via CompanyAssignment(Role) ;  Organization ──> FirmObligationRollup
```

---

## 21. Client Portal Architecture

A restricted surface for the firm's end clients; minimal model, strict single-company scope.

**ClientPortalAccess** ◆ ʸPII
- Purpose: a client user's access to exactly one company's portal (upload, view reports/archive, notifications).
- Ownership: company-scoped; Identity.
- Relationships: `User (Client) (1) ──< (1) ClientPortalAccess ──> Company`; constrained to `Client User` role on that company only.
- Lifecycle: `invited → active → revoked`.
- State transitions: pinned to one company; cannot be elevated to staff roles.

**DocumentRequest**
- Purpose: a "we need this document from you" task the firm raises for the client (drives the portal to-do list).
- Ownership: company-scoped; DocIntel/Notification.
- Relationships: `Company (1) ──< (N) DocumentRequest ──> ClientPortalAccess`; fulfilled by an `IngestionItem`/`Document`.
- Lifecycle: `requested → fulfilled | cancelled | overdue`.
- State transitions: `requested → fulfilled` on matching upload; reminders on `overdue`.

**SharedReport**
- Purpose: a `ReportRun` snapshot made visible to a client in the portal.
- Ownership: company-scoped; Reporting.
- Relationships: `ReportRun (1) ──< (N) SharedReport ──> ClientPortalAccess`.
- Lifecycle: `shared → viewed → revoked`.
- State transitions: visibility controlled; revocable; access logged.

ERD:
```
User(Client) ──< ClientPortalAccess ◆ ──> Company (single scope)
Company ──< DocumentRequest ──fulfilled-by──> Document
ReportRun ──< SharedReport ──> ClientPortalAccess
```

---

## 22. Event Architecture

The nervous system: domain events drive the async pipeline, projections, audit, and notifications. Built on the **transactional outbox** pattern so events are never lost and never decouple from the state change that produced them.

**DomainEvent** ⊕ (event log / outbox)
- Purpose: an immutable fact that something happened (DocumentReceived, ExtractionCompleted, SuggestionAccepted, EntryPosted, PeriodLocked, ReturnFiled, SignatureApplied, TransactionReconciled, etc.).
- Ownership: company/tenant-scoped; AuditAndEvents.
- Relationships: emitted by an aggregate within the same transaction as its state change; consumed by subscribers (Projections, Audit, Notification, AI pipeline).
- Key attributes: event type, aggregate type + id, payload (versioned), tenant/company, occurred-at, sequence, correlation/causation ids.
- Lifecycle: `recorded → published → consumed (per subscriber)`; retained for replay/rebuild.
- State transitions: *immutable*; per-subscriber delivery tracked separately.

**EventSubscription / Projection-Checkpoint**
- Purpose: tracks each subscriber's position in the event stream (for rebuildable read models and at-least-once delivery).
- Ownership: platform; per-context.
- Relationships: subscribers (Reporting projections, Notification, AI workers) advance checkpoints over `DomainEvent`.
- Lifecycle: `active → rebuilding (replay) → caught-up`.
- State transitions: replay resets checkpoint to rebuild projections deterministically.

**Pipeline semantics.**
- **Idempotent consumers** (the document pipeline must never double-post on retry — keyed by content hash + event id).
- **Ordering** preserved per aggregate (per `company_id`/aggregate stream).
- Events power the **CQRS split**: writes go to aggregates; reads to projections fed by events.
- The **audit trail and event log are distinct**: events drive behavior; `AuditEvent` is the human-/regulator-facing evidence (though both are append-only).

ERD:
```
Aggregate(write) ──(same txn: outbox)──> DomainEvent ⊕ ──> [Projections | AuditEvent | Notification | AI workers]
EventSubscription tracks per-consumer checkpoint (replayable)
```

---

## 23. Notification Architecture

**Notification** ◆
- Purpose: an alert to a user (deadline approaching, item to review, approval needed, client upload, anomaly, submission confirmed/failed).
- Ownership: user/company-scoped (firm: grouped by company); Notification.
- Relationships: produced from `DomainEvent`s and `ComplianceObligation`/`Anomaly`; references its subject entity for deep-linking; delivered via channels.
- Key attributes: type, severity (info/attention/urgent), subject reference, read/acted status, grouping key (company), locale.
- Lifecycle: `created → delivered → read → acted | dismissed | expired`.
- State transitions: `created → delivered → read → acted/dismissed`; deadline notifications escalate (info → attention → urgent) as due dates near.

**NotificationPreference**
- Purpose: per-user channel/type preferences (in-app, email, push) and quiet hours.
- Ownership: user-scoped; Notification.
- Relationships: `User (1) ──< (N) NotificationPreference`.
- Lifecycle: `default → customized`.
- State transitions: *settings*.

**DeliveryChannel / DeliveryAttempt**
- Purpose: a channel binding (email/push/in-app) and the record of delivery attempts (for reliability).
- Ownership: platform/user-scoped; Notification.
- Relationships: `Notification (1) ──< (N) DeliveryAttempt ──> DeliveryChannel`.
- Lifecycle: `pending → sent → delivered | failed → retried`.
- State transitions: retry with backoff; failures surfaced, never silently dropped for critical (deadline/compliance) types.

ERD:
```
DomainEvent / ComplianceObligation / Anomaly ──> Notification ◆ ──< DeliveryAttempt ──> Channel
User ──< NotificationPreference
```

---

## 24. Data Retention Architecture

Retention reconciles **statutory accounting/tax record-keeping** (multi-year) with **GDPR** (minimization/erasure).

**RetentionPolicy** ⏱
- Purpose: rules defining how long each data class is kept (e.g. tax records and audit per Bulgarian/EU statute; operational drafts shorter), and what happens at expiry (archive/anonymize/delete).
- Ownership: tenant-scoped (defaults from jurisdiction); Platform/Compliance.
- Relationships: applies to `Document`/`StorageObject`/`JournalEntry`/`AuditEvent`/PII fields via a `retention_class`.
- Lifecycle: `default → customized (within legal bounds) → versioned ⏱`.
- State transitions: changes are effective-dated; never shorten below statutory minimums.

**RetentionSchedule** (derived)
- Purpose: the computed disposition date per record from its `retention_class` + events (e.g. fiscal-year close).
- Ownership: company-scoped; Platform.
- Relationships: references each retainable entity/object.
- Lifecycle: `accruing → eligible → disposed (archived/anonymized/deleted)`.
- State transitions: `eligible → disposed` only if **no LegalHold** applies.

**LegalHold**
- Purpose: a freeze on disposition for records under audit/dispute/investigation, overriding normal retention.
- Ownership: company/tenant-scoped; Compliance.
- Relationships: pins affected entities/objects; blocks `RetentionSchedule` disposition.
- Lifecycle: `placed → active → released`.
- State transitions: while `active`, no deletion/anonymization occurs, even for GDPR erasure (statutory override documented).

**ErasureRequest** (GDPR)
- Purpose: a data-subject erasure request; reconciled against statutory retention and legal holds.
- Ownership: tenant-scoped; Compliance.
- Relationships: targets PII across entities; partial-erasure/anonymization where full deletion is legally barred.
- Lifecycle: `received → assessed → executed (full/partial/deferred) → recorded`.
- State transitions: `assessed → deferred` when retention/hold blocks; executed actions logged to audit.

ERD:
```
RetentionPolicy ⏱ ──classifies──> {Document/StorageObject/JournalEntry/AuditEvent/PII}
RetentionSchedule ──disposition──(blocked by)──> LegalHold ;  ErasureRequest ──reconciled-with──> RetentionPolicy/LegalHold
```

---

## 25. Database Partitioning Strategy

The goal is isolation, predictable performance on high-volume tables, and clean archival — all aligned to the tenancy and period structure.

### 25.1 What grows and how to split it

| Data class | Volume driver | Partition strategy | Rationale |
|------------|---------------|--------------------|-----------|
| `JournalLine`, `JournalEntry` | postings over time | **Range by period** (month/fiscal year), sub-keyed by `tenant_id` | Most queries are period-bounded; old periods become read-only/archivable |
| `BankTransaction` | statement volume | **Range by date** + tenant | Reconciliation works within recent periods |
| `Document` / `StorageObject` | capture volume | Metadata: hash/list by `tenant_id`; blobs in object storage with **lifecycle tiering** | Blobs don't belong in the relational store |
| `AuditEvent` | every change | **Range by time** (append-only), tenant-keyed; sealed by `AuditChainCheckpoint` | Write-heavy, append-only, rarely updated; old segments archived |
| `DomainEvent` | every change | **Range by time**, tenant-keyed | Event log; replayable; old segments cold |
| `Notification` | alerts | **Range by time**, tenant-keyed; aggressive TTL/archival | Short useful life |
| `VatLedgerEntry` | per period | **Range by VAT period** + tenant | Period-scoped, frozen at filing |
| Reference/master data | small, stable | Not partitioned (cached) | Low volume |

### 25.2 Tenancy + partition interplay
- **Primary scoping is `tenant_id`** (security via RLS); **partitioning is by time/period** for the big append-only tables. Composite keys lead with tenant then period.
- **Large/dedicated tenants** can be **physically separated** (dedicated database/residency) via the `tenant.placement` attribute — partitioning logic is unchanged.
- **Hot/cold tiering:** current + recent fiscal years stay hot; closed years move to cheaper storage/partitions, still queryable for audit, eligible for archival per retention.
- **Read replicas** serve reporting/dashboards and heavy read projections, isolating them from the transactional write path.

### 25.3 Archival
Closed fiscal years and aged audit/event segments are archived to cold partitions/storage (still immutable, still retrievable for the statutory window), then disposed only when `RetentionSchedule` allows and no `LegalHold` applies (Section 24).

---

## 26. Performance Strategy

### 26.1 Never aggregate the whole ledger live
- **Balances are projected, not summed on read.** `LedgerBalance`/`TrialBalanceSnapshot`/`Receivable`/`Payable` are **materialized projections** maintained from `DomainEvent`s. Dashboards and reports read projections; they never scan all `JournalLine`s.
- **Period snapshots** freeze opening/closing balances so each period query starts from a known base.

### 26.2 CQRS split
- **Writes** go through aggregates (consistency, invariants, audit).
- **Reads** go to denormalized projections (speed). Projections are **rebuildable** from the event log for resilience and schema evolution.

### 26.3 Indexing principles (conceptual)
- Composite access paths lead with `tenant_id` (+ `company_id`) then the common filter (date/period/status/counterparty) — matching the dashboard, queue, ledger, and VAT screens.
- Full-text index for document search; fingerprint index for duplicate detection; foreign-key/lookup indexes for lineage drill-down (document↔entry↔return).
- Avoid wide unbounded scans; every list screen is paginated/virtualized and period- or status-bounded.

### 26.4 Asynchronous heavy work
- OCR/extraction/AI, statement import, SAF-T generation, report builds, and submissions run on **queue-backed workers** (idempotent), absorbing month-end and VAT-deadline spikes; the UI returns immediately and is updated via events/notifications.

### 26.5 Caching
- Reference/master data (chart of accounts, VAT rates, exchange rate, jurisdiction rules) is cached and invalidated on version change (effective-dated).
- Per-tenant entitlement/permission decisions cached with short TTL + event-driven invalidation.

### 26.6 Scaling axes (recap)
- **Many small tenants** → RLS shared schema + caching reference data.
- **Document/transaction volume** → async pipeline + time-partitioning + projections.
- **Firm concurrency / bulk ops** → read replicas + projection-backed firm rollups + batched writes.

---

## 27. Compliance Architecture (data dimension)

### 27.1 Immutability & evidentiary integrity
- Posted ledger, VAT register lines, signed artifacts, submissions, confirmations, and audit events are **append-only**; corrections are new records. This is both an accounting requirement and the basis of regulatory defensibility.
- The **hash-chained `AuditEvent`** stream + `AuditChainCheckpoint`s make tampering detectable — covering uploads, edits, AI recommendations, human corrections, approvals, signatures, and submissions, with the AI as a named actor.

### 27.2 SAF-T readiness
- The model is **SAF-T-shaped from day one**: `AccountMapping` to the SAF-T taxonomy, full counterparty/invoice/payment/asset/inventory coverage in the data, and a **versioned `SafTSchemaVersion`** behind an ACL. When the obligation reaches the target segment, export is a mapping/generation step, not a re-model.

### 27.3 GDPR / privacy by design
- **PII is mapped** (entities marked ʸPII: `User`, `Counterparty` contacts, `Document` contents, `Certificate`, portal access) enabling targeted access control, export, and erasure.
- **EU data residency** for all primary data, backups, and (where possible) AI processing; AI sub-processors under **zero-retention/no-training** terms.
- **Data-subject rights** via `ErasureRequest`/export, **reconciled against statutory retention and `LegalHold`** — where full deletion is legally barred, anonymization/partial erasure is applied and documented.
- **Minimization & purpose:** sensitive identifiers stored only where needed; cross-tenant data never co-mingled (including AI learning).

### 27.4 Security posture (data)
- **Encryption in transit and at rest** (DB, object storage, backups); envelope encryption via KMS; field-level encryption for the most sensitive identifiers.
- **Tenant isolation** enforced at the data layer (RLS) beneath application checks; no relationship crosses `tenant_id`.
- **Segregation of duties** modeled (preparer ≠ approver for state submissions); **non-overridable guardrails** in the permission model (state submission requires Approver + KEP).
- **No private-key custody** for KEP; signing happens in the holder's/QTSP's secure environment; only `Signature` evidence persists.

### 27.5 Currency-changeover compliance
- The **BGN→EUR redenomination boundary (1 Jan 2026)** is explicit in opening balances and comparatives; the **fixed rate 1.95583** is an immutable `ExchangeRate`; dual-display obligations (until 8 Aug 2026) are satisfied by storing/representing both currencies, switchable by configuration afterward without data change.

### 27.6 Compliance entity recap
`AuditEvent` ⊕ · `Signature` ⊕ · `SubmissionArtifact`/`Confirmation` ⊕ · `SafTExport`/`SafTSchemaVersion` · `RetentionPolicy`/`LegalHold`/`ErasureRequest` · `CompanyVatRegistration` ⏱ · `ExchangeRate` (fixed) — together provide the evidentiary, tax, privacy, and currency-transition backbone.

---

## Closing — how this model holds together

- **One spine:** Tenant → Company → (FiscalYear → Period) → JournalEntry/Line, with master data referenced and everything else either feeding into or derived from the ledger.
- **Three immutability anchors:** the posted ledger, the signed/submitted compliance artifacts, and the hash-chained audit trail — corrections are always additive.
- **One isolation rule:** `tenant_id` is sacred; RLS enforces it; AI learning never crosses it.
- **One performance principle:** read from projections fed by an append-only event log; never live-aggregate the ledger.
- **One compliance philosophy:** shape data for SAF-T/VAT/GDPR now, wrap volatile external schemas (NRA, KEP, banks, VIES) behind ACLs, and keep the human in command of anything touching money or the state.

Together with the Master Architecture, UX Architecture, Design System, and Screen Specifications, this domain model and data architecture complete the foundation: engineering can derive the physical schema, RLS policies, event contracts, and projections directly from these entities, relationships, lifecycles, and strategies — without any change to the product or compliance intent.

*End of v1.0 domain model & database architecture.*
