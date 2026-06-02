# AI Accounting Platform — Accounting Rules Engine Architecture

**Document type:** Rules engine architecture (conceptual — no code)
**Builds on:** Master Architecture, Domain Model & Data Architecture, AI Architecture (all v1.0)
**Acting as:** Senior ERP Architect · Senior Accounting Architect · Senior Tax Architect
**Status:** v1.0 — rules engine baseline

---

## Scope & intent

The Accounting Rules Engine is the deterministic brain that turns a **normalized economic event** (a parsed document, an issued invoice, a bank transaction, or a scheduled trigger such as period-end) into **proposed accounting outcomes** — journal entries, VAT treatment, categorization, recognition and depreciation schedules — together with a confidence score, a plain-language explanation, and a full rule trace.

Three architectural commitments govern everything below:

1. **Rules are data, not code.** Every rule is declarative, versioned, effective-dated, and editable without a deployment — the same "configuration over hard-coding" stance used for VAT rates and the SAF-T schema. This is what lets the platform absorb Bulgarian regulatory change (and later, new jurisdictions) without re-engineering.
2. **The engine proposes; it never writes the ledger.** Outcomes are *proposals* that flow through the existing review → approval → posting pipeline. Only approved facts enter the append-only ledger. The engine has no authority to post, sign, or file.
3. **Deterministic before heuristic; compliance above all.** Regulatory/deterministic rules outrank AI/heuristic rules for *selection*, and **compliance rules are hard constraints that can veto any outcome — including a human's** (a human may choose among legal options, but cannot produce an illegal posting).

---

## 0. Engine Overview

### 0.1 Position in the system

```
        ┌─────────────────────────────────────────────────────────┐
 EVENT  │  Document/Extraction · Invoice issued · Bank txn ·        │
 IN ───▶│  Period-end trigger · Manual entry · Asset acquisition    │
        └───────────────┬─────────────────────────────────────────┘
                        ▼
            ┌───────────────────────────┐
            │   RULES ENGINE (this doc)  │  resolves rules, computes,
            │   12 sub-engines + core    │  generates schedules, validates
            └───────────────┬───────────┘
                            ▼  emits
            ┌───────────────────────────┐
            │  PROPOSAL (entry draft +   │  + confidence + explanation
            │  VAT + schedules + trace)  │  + rule trace
            └───────────────┬───────────┘
                            ▼
   Review Queue ─▶ Human approve/correct ─▶ POST (immutable ledger) ─▶ Audit
                            ▲
                  (AI Override Rules decide auto-apply vs defer)
```

The engine sits between **DocIntel/Invoicing/Banking** (which supply events) and the **Ledger/Tax** contexts (which receive approved proposals). It reads master data (chart of accounts, VAT codes, counterparties, company config, learned profiles) and never bypasses the human-in-the-loop pipeline.

### 0.2 The twelve sub-engines (responsibilities at a glance)

| # | Sub-engine | Turns … into … |
|---|------------|----------------|
| 1 | **Posting Rules** | an event → a balanced double-entry (Dr/Cr account lines) |
| 2 | **VAT Rules** | a transaction → VAT treatment, rate, deductibility, RC/intra-EU, ledger entries |
| 3 | **Recognition Rules** | a transaction → the correct period & accrual/deferral timing |
| 4 | **Expense Categorization** | an expense → category/account + deductibility + dimensions |
| 5 | **Revenue Recognition** | a sale → point-in-time vs over-time recognition + deferred-revenue schedule |
| 6 | **Fixed Asset Rules** | a purchase → capitalize vs expense + asset record + category |
| 7 | **Depreciation Rules** | an asset → book & tax depreciation schedules + periodic postings |
| 8 | **Period Closing Rules** | a period-end trigger → ordered close steps + lock gating |
| 9 | **Validation Rules** | any proposal → pass / warning / blocking error |
| 10 | **AI Override Rules** | a proposal + confidence + risk → auto-apply vs human review |
| 11 | **Exception Handling** | a no-match / conflict / failure → routing, fallback, suspense, escalation |
| 12 | **Compliance Rules** | any outcome → permitted or vetoed (supreme hard constraints) |

### 0.3 Core engine entities (extending the domain model)

- **Rule** — a single declarative unit (condition → action) with scope, type, priority, effective dates, version, owner, and legal rationale.
- **RuleSet / RulePack** — a versioned, effective-dated collection grouped by scope (e.g. the *Bulgaria jurisdiction pack*, an *industry template*, a *company override set*).
- **RuleScope** — the dimension on which a rule applies (statutory / jurisdiction / industry / firm / company / counterparty / learned).
- **RuleVersion** — an immutable, effective-dated snapshot of a rule or pack.
- **RuleEvaluation / RuleTrace** — an immutable record of which rules fired (and which lost) for a given proposal — the explainability and audit substrate.
- **RecognitionSchedule / DepreciationSchedule** — generated multi-period schedules (Sections 5, 7).
- **FixedAsset** — a capitalized asset and its parameters (Section 6).
- Relates to existing entities: `PostingRule/EntryTemplate`, `TaxCode ⏱`, `AISuggestion`, `ValidationCheck`, `JournalEntry`, `AccountMapping`, `CompanyLearningProfile`, `AccountingPeriod`.

---

## Rule Anatomy

Every rule, regardless of sub-engine, shares one structure so the engine can evaluate them uniformly.

| Part | Meaning | Example (conceptual) |
|------|---------|----------------------|
| **Identity** | stable id + human name | "BG-default: domestic standard-rate purchase" |
| **Scope** | which layer/dimension it belongs to | jurisdiction = BG · company = Acme · counterparty = Supplier X |
| **Type** | mapping / calculation / constraint / schedule / trigger | mapping |
| **Condition (WHEN)** | the predicate over the normalized event/context | document type = purchase invoice AND counterparty VAT-registered BG AND category = materials |
| **Action (THEN)** | the produced outcome or transformation | Dr 601, Dr 4531 (VAT), Cr 401 |
| **Priority** | tie-break weight within its layer | 100 |
| **Effective dates ⏱** | valid_from / valid_to | from 2026-01-01 |
| **Severity** (constraints only) | error (veto) / warning (flag) | error |
| **Confidence** (heuristic only) | for AI/learned rules | 0.92 |
| **Provenance** | source/owner + legal reference + rationale | ЗДДС art. … · firm policy · learned from 7 corrections |
| **Version** | immutable version id | v3 |

**Rule types and how they combine in one evaluation:**
- **Mapping rules** select accounts/categories/treatments (Posting, Expense, VAT-code selection).
- **Calculation rules** compute amounts (VAT amounts, depreciation, recognition splits, currency conversion at the fixed rate).
- **Constraint rules** assert invariants and may veto or flag (Validation, Compliance).
- **Schedule rules** generate future-dated entries (Recognition, Depreciation).
- **Trigger rules** fire on events/time (Period Closing).

---

## Rule Hierarchy

The hierarchy has **two axes** that are deliberately kept separate, because conflating them is the classic accounting-engine failure mode.

### A. Authority axis (for *constraints* — who can veto)

Hard constraints are applied **top-down and are absolute**: a higher layer can forbid what a lower layer (or a human) proposes.

```
 1. COMPLIANCE / STATUTORY      ← supreme; non-overridable by anyone (incl. user & AI)
 2. VALIDATION INVARIANTS       ← double-entry, period-lock, completeness (blocking)
 3. JURISDICTION CONSTRAINTS    ← BG VAT correctness, numbering, deductibility limits
 ─────────────────────────────  (constraints below are advisory/warnings)
 4. FIRM / COMPANY POLICY        ← approval thresholds, SoD, internal limits
```

A proposal that violates layers 1–3 **cannot be posted**, full stop. Layer 4 violations produce warnings/approvals, not vetoes.

### B. Specificity axis (for *selection* — which mapping wins)

When multiple permissible mappings could apply, the **most specific applicable rule wins**, with AI filling only the gaps where no deterministic rule exists.

```
 MOST SPECIFIC  ▲  6. User manual override        (this event, this time)
                │  5. Company-learned (counterparty/pattern-specific)
                │  4. Company configuration         (explicit company rule)
                │  3. Industry/template pack
                │  2. Jurisdiction default (Bulgaria pack)
 LEAST SPECIFIC ▼  1. AI heuristic suggestion       (gap-filler, lowest authority)
```

**The interaction of the two axes is the heart of the engine:**
- The **specificity axis chooses** the candidate outcome (e.g. which expense account and VAT code).
- The **authority axis validates** that the chosen outcome is legal; if it violates a hard constraint, the outcome is rejected/flagged regardless of how specific or confident the selecting rule was.
- A **human override (specificity 6) beats AI and defaults for selection**, but is still subject to compliance/validation vetoes (authority 1–3). A user can pick any *legal* treatment; they cannot pick an *illegal* one.
- **AI (specificity 1) never overrides** a more specific deterministic rule and never overrides any constraint; it proposes where deterministic rules are silent.

### C. Jurisdiction packs (expansion-ready)
Statutory, jurisdiction-default, and jurisdiction-constraint layers are packaged as a **versioned jurisdiction pack** (Bulgaria first). Adding a country = adding a pack + locale, not changing the engine. Company/firm/learned layers sit on top, per tenant.

---

## Rule Priority & Conflict Resolution

Within a single specificity layer, more than one rule may match. Resolution order:

1. **Authority filter first.** Remove any candidate that would violate a hard constraint (compliance/validation/jurisdiction). Constraints are evaluated before selection completes.
2. **Specificity.** Prefer the rule whose condition is most specific (counterparty-specific > category-specific > type-generic).
3. **Effective-date.** Among equally specific rules, the one whose effective window contains the **event date** wins (never "today" — always the transaction's date).
4. **Explicit priority weight.** A numeric priority breaks remaining ties (used to sequence calculation rules and to let a firm pin a preferred default).
5. **Confidence (heuristic only).** Among AI/learned candidates of equal specificity, higher confidence wins — but only after deterministic rules have had their chance.
6. **Deterministic-over-heuristic tiebreaker.** If a deterministic rule and an AI suggestion both produce a valid selection at the same specificity, the **deterministic rule wins**; the AI suggestion is recorded as the runner-up in the trace.

**Conflict outcomes:**
- **Resolvable conflict** → winner selected, losers recorded in the `RuleTrace` (for explainability and learning).
- **Irreconcilable conflict** (two equally specific, equally authoritative rules disagree) → no auto-selection; routed to the **Exception Handling engine** (Section 11) and the human review queue, with both options surfaced.
- **No match** → gap handled by AI suggestion if available, else suspense/holding treatment + review (Section 11).

---

## Rule Execution Flow

A single, ordered pipeline runs for every event. It is **idempotent** (safe to re-run; never double-posts) and produces a **Proposal + RuleTrace**.

```
① NORMALIZE
   Event → canonical context (type, dates, counterparty + VAT status,
   amounts, currency→EUR at fixed rate, category hints, company, period)

② RESOLVE APPLICABLE RULE SET
   Gather rules whose scope matches (jurisdiction pack + industry + company
   + learned) AND whose effective window contains the EVENT DATE

③ RECOGNITION  (Section 3)
   Determine period & timing (accrual/deferral/prepayment); may split or defer

④ SELECT MAPPINGS  (specificity axis)
   Posting accounts (1) · Expense category (4) · Revenue treatment (5) ·
   Capitalize? (6)   — most-specific applicable rule wins; AI fills gaps

⑤ CALCULATE  (calculation rules)
   VAT treatment & amounts (2) · recognition splits (5) · depreciation (7) ·
   currency conversion — produce concrete numbers

⑥ GENERATE SCHEDULES (where applicable)
   RecognitionSchedule (5) · DepreciationSchedule (7) · accruals

⑦ ASSEMBLE PROPOSAL
   Balanced draft JournalEntry/-ies + VAT ledger lines + schedules,
   with confidence + explanation

⑧ VALIDATE  (Section 9 — constraints)
   Double-entry balance · period open · account valid · VAT consistency ·
   duplicate · completeness → pass / warning / blocking error

⑨ COMPLIANCE GATE  (Section 12 — supreme vetoes)
   Regulatory invariants; any violation = reject/flag regardless of layer

⑩ AI OVERRIDE DECISION  (Section 10)
   If high confidence + low risk + opted-in + ⑧⑨ clean → eligible for auto-apply
   else → human review (default)

⑪ EMIT
   → Auto-post (audited, reversible)  OR  → Review Queue
   Always write the RuleTrace (which rules fired/lost) for audit & explainability
```

Notes:
- Steps ③–⑦ are **selection + calculation** (specificity axis); steps ⑧–⑨ are **constraint enforcement** (authority axis). This ordering guarantees that nothing illegal can be emitted even if a confident rule selected it.
- The flow runs the same way for AI-sourced and manual events; only the *source* and the AI-override eligibility differ.
- The pipeline is **event-driven and asynchronous** (per the event architecture); heavy steps (AI, schedule generation) run on workers, but the rule evaluation for one event is deterministic and replayable.

---

## The Twelve Rule Sub-Engines

Each sub-engine is specified by: **purpose · inputs · rule logic · outputs · Bulgaria specifics · authority/priority · failure mode**.

### 1. Posting Rules Engine
- **Purpose:** map a normalized event to a balanced double-entry posting.
- **Inputs:** event type, counterparty, category, VAT treatment (from engine 2), amounts (EUR + original), company chart of accounts, learned profile.
- **Rule logic:** mapping rules of the form *(event pattern + counterparty + category + VAT) → (debit/credit account lines)*. Resolution by the specificity axis: **company-learned (this counterparty) > company-config > industry template > jurisdiction default > AI suggestion**. Accounts resolved against the company's CoA; the engine guarantees Σdebit = Σcredit.
- **Outputs:** a draft `JournalEntry` with `JournalLine`s, plus the selected `PostingRule`/`EntryTemplate` reference and a rule trace.
- **Bulgaria specifics:** postings to the Bulgarian national chart of accounts (classes 1–7); VAT receivable/payable accounts (e.g. 4531/4532) wired from the VAT engine; EUR functional currency with BGN legacy handling.
- **Authority/priority:** selection rules (specificity); must satisfy double-entry validation (engine 9).
- **Failure mode:** no mapping → AI gap-fill → if still unresolved, post to a configured **suspense account** and route to review (engine 11).

### 2. VAT Rules Engine
- **Purpose:** determine the VAT treatment and compute VAT for a transaction, and emit VAT-register entries.
- **Inputs:** transaction nature (goods/services), direction (purchase/sale), counterparty VAT status & country (from `CompanyVatRegistration` + counterparty), place-of-supply, document/supply date, effective `TaxCode` set.
- **Rule logic:** decision rules selecting a `TaxCode` — **Standard 20% · Reduced 9% · Zero · Exempt · Reverse-charge · Intra-EU** — then calculation rules computing net/VAT/total, **deductibility**, and **reverse-charge self-assessment** (output + input VAT). Rates are **effective-dated**; treatment resolves as-of the supply date.
- **Outputs:** VAT treatment + amounts on the posting; `VatLedgerEntry` (purchase/sales register) with type tag; deductibility flag; data for the VAT return.
- **Bulgaria specifics:** ЗДДС rules — standard 20% / reduced 9%; reverse charge for certain supplies & intra-EU acquisitions; VIES validation for intra-EU counterparties; correct register classification (Std/RC/Intra-EU/Exempt).
- **Authority/priority:** VAT correctness is a **jurisdiction hard constraint** — an incorrect rate/treatment is vetoed, not just flagged. Selection still respects company overrides where legally permitted.
- **Failure mode:** unverifiable counterparty VAT (VIES down) → warning + allow proceed with flag for later; ambiguous treatment → review with options.

### 3. Recognition Rules
- **Purpose:** assign the correct accounting **period** and **timing** (when, not just where).
- **Inputs:** document/supply/issue dates, basis (accrual vs cash where applicable), prepayment/advance markers, open/closed period status.
- **Rule logic:** period-assignment rules (by supply date within the open period); accrual rules (expense/revenue incurred but not invoiced) and deferral rules (prepayments, advances, deferred items) that split or defer the posting across periods; cut-off rules near period boundaries.
- **Outputs:** the target `AccountingPeriod`; any accrual/deferral postings or a deferral marker feeding engine 5; period assignment on the proposal.
- **Bulgaria specifics:** NSS/IFRS basis selection; accrual basis default for VAT-registered entities; correct period for VAT (supply date drives VAT period).
- **Authority/priority:** must not target a **locked** period (validation/compliance veto → routes to current open period or correction workflow).
- **Failure mode:** date in a closed period → blocked; offered as a current-period adjustment via review.

### 4. Expense Categorization Rules
- **Purpose:** classify an expense to a category/account, set deductibility, and tag analytic dimensions.
- **Inputs:** supplier, line descriptions, amounts, historical coding for this supplier (learned profile), category taxonomy, deductibility rules.
- **Rule logic:** selection by specificity — **learned (supplier → category) > company config > template > AI suggestion**; deductibility and VAT-deductibility determined by deterministic rules (some categories are non-/partly-deductible by law). AI proposes for novel suppliers; corrections feed the learning loop.
- **Outputs:** expense account/category, deductibility flags, dimensions; feeds engines 1 and 2.
- **Bulgaria specifics:** representation/entertainment and certain expenses have limited or no VAT deductibility / are subject to expense taxes — encoded as deterministic constraints, not AI guesses; capitalization check handed to engine 6.
- **Authority/priority:** AI-heavy *selection*, but **deductibility limits are jurisdiction constraints** (authority axis) that cap whatever was selected.
- **Failure mode:** low-confidence categorization → review (engine 10/11); never silently mis-deducts.

### 5. Revenue Recognition Rules
- **Purpose:** determine **when and how** revenue is recognized and generate deferred-revenue schedules.
- **Inputs:** sale type (one-off / subscription / milestone / advance), invoice vs proforma, delivery/performance dates, basis (NSS/IFRS).
- **Rule logic:** point-in-time vs over-time recognition rules; advance/proforma → **deferred revenue** until performance; subscription/milestone → **RecognitionSchedule** spreading revenue across periods with scheduled postings; matching to performance obligations.
- **Outputs:** immediate revenue posting and/or a `RecognitionSchedule` (future-dated proposals released per period); deferred-revenue liability postings.
- **Bulgaria specifics:** proforma never recognizes revenue (consistent with the invoicing model); VAT timing vs revenue timing handled distinctly (VAT on supply/payment per ЗДДС; revenue per NSS/IFRS).
- **Authority/priority:** selection by company/basis config; schedule postings still pass validation/compliance each period.
- **Failure mode:** ambiguous performance pattern → default to conservative (defer) + review.

### 6. Fixed Asset Rules
- **Purpose:** decide whether a purchase is **capitalized** as a fixed asset (vs expensed) and create the asset record.
- **Inputs:** item value, nature, useful life expectation, **capitalization threshold**, asset category taxonomy.
- **Rule logic:** capitalization rules (value ≥ threshold AND long-lived AND category-eligible → capitalize); asset-category assignment; componentization rules (split major components with different lives); acquisition postings (asset account, input VAT, payable).
- **Outputs:** a `FixedAsset` record (category, cost, in-service date, useful life), the acquisition posting, and a handoff to engine 7 for depreciation.
- **Bulgaria specifics:** capitalization threshold per company policy within statutory norms; asset categories aligned to **book (NSS/IFRS)** and **tax (CITA) categories** for dual depreciation.
- **Authority/priority:** threshold/eligibility are company-config within jurisdiction constraints.
- **Failure mode:** borderline capitalize/expense → AI suggests + review; once capitalized, changes go through controlled adjustment.

### 7. Depreciation Rules
- **Purpose:** generate **book and tax** depreciation schedules and the periodic depreciation postings.
- **Inputs:** `FixedAsset` (cost, in-service date, category), method, useful life, conventions, basis.
- **Rule logic:** method rules (straight-line, declining-balance) by asset category; useful-life and **convention** rules (when depreciation starts — e.g. month following in-service); schedule-generation rules producing a `DepreciationSchedule` of future periodic postings; **dual schedules** — book depreciation (NSS/IFRS) and **tax depreciation** — maintained in parallel; impairment/disposal handling.
- **Outputs:** a `DepreciationSchedule` per basis; periodic depreciation proposals released each period (via engine 8); book-vs-tax difference data for tax reporting.
- **Bulgaria specifics:** Bulgaria distinguishes **accounting depreciation** (per NSS/IFRS) from **tax depreciation** under the Corporate Income Tax Act, which groups assets into statutory **categories with maximum annual tax-depreciation rates**. These rates and categories are stored as **effective-dated configuration in the jurisdiction pack** (never hard-coded), so a statutory change is a versioned config update; the engine tracks the book/tax difference.
- **Authority/priority:** method/life are company-config; **tax-depreciation maximums are jurisdiction constraints** (cannot exceed statutory caps).
- **Failure mode:** missing parameters → asset flagged "awaiting depreciation setup"; never silently zero-depreciates.

### 8. Period Closing Rules
- **Purpose:** orchestrate an ordered, gated period close and lock.
- **Inputs:** period-end trigger, period state, outstanding work (unprocessed docs, unreconciled items), schedules due.
- **Rule logic:** an **ordered sequence of trigger rules**: (a) precondition checks — all documents processed, review queue clear, bank reconciled; (b) run period-due **accruals/deferrals** (engine 3) and **depreciation** (engine 7) and **revenue recognition** releases (engine 5); (c) validate the trial balance (engine 9); (d) align/close the **VAT period**; (e) **lock** the period; (f) at fiscal year-end, carry forward opening balances. Each step gates the next; blocking conditions stop the close.
- **Outputs:** scheduled close postings, a lock on the `AccountingPeriod`, year-end carry-forward, a close checklist/result.
- **Bulgaria specifics:** monthly close aligned to the VAT period (filing by the 14th); the **EUR/BGN redenomination boundary** handled at the 31 Dec 2025 / 1 Jan 2026 year-end carry-forward.
- **Authority/priority:** close steps are deterministic triggers; **lock is a compliance state** — once a period is filed, it cannot reopen without an audited, Approver-gated correction.
- **Failure mode:** unmet precondition (e.g. items still in review) → close blocked with a clear checklist of what's outstanding; partial close never silently completes.

### 9. Validation Rules
- **Purpose:** enforce accounting invariants and data-quality checks on every proposal — deterministic, trusted over AI.
- **Inputs:** the assembled proposal, master data, period state, history.
- **Rule logic:** constraint rules with **severity**: **blocking (error)** — double-entry imbalance, posting to a locked period, invalid/inactive account, VAT inconsistency (net + VAT ≠ total), missing mandatory field, numbering gap; **warning** — unusual amount, possible duplicate, low-confidence categorization, VIES-unverified. Deterministic checks (EIK checksum, IBAN, arithmetic, VIES) are authoritative over any AI estimate.
- **Outputs:** validation result (pass / warning / blocking) attached to the proposal; blocking errors prevent posting and pinpoint the field; failures may spawn `VatValidationIssue`/`Anomaly`.
- **Bulgaria specifics:** EIK checksum, VAT-number/VIES validation, sequential-numbering integrity, register consistency.
- **Authority/priority:** **authority axis** — blocking errors veto regardless of how the outcome was selected.
- **Failure mode:** blocking error → proposal cannot post, routed to review with the specific fix; warnings require acknowledgment.

### 10. AI Override Rules
- **Purpose:** govern the AI's authority — precisely when it may auto-apply an outcome versus defer to a human, and how human overrides of AI are handled.
- **Inputs:** proposal confidence, **risk class** of the action, company auto-posting opt-in, validation/compliance results, the rule trace (deterministic vs heuristic source).
- **Rule logic:** auto-apply is permitted **only when all hold**: confidence ≥ the high threshold (e.g. tiered per the design system), risk class = low, the company opted in, validation (9) clean, compliance (12) clean, and no irreconcilable conflict. Otherwise → human review (the safe default). **Hard ceilings (non-overridable):** AI may never auto-apply anything touching a **state submission, signature, period lock, or compliance-vetoed outcome**; AI may never override a more specific deterministic rule or any constraint. **Human override of AI** is always allowed (within legality), is recorded, and **feeds the learning loop** (engine 4/posting learning).
- **Outputs:** an auto-apply vs review decision; learning signals from overrides; the override policy recorded in the trace.
- **Bulgaria specifics:** anything feeding NAP/KEP is excluded from auto-apply by rule.
- **Authority/priority:** AI sits at the **bottom of the specificity axis** and has **zero authority** on the constraint axis.
- **Failure mode:** uncertainty defaults to human review; the engine errs toward deferral, never toward silent automation.

### 11. Exception Handling Rules
- **Purpose:** define what happens when the normal path can't complete — no match, conflict, validation failure, external outage, ambiguity.
- **Inputs:** the failure type and context from any prior step.
- **Rule logic:** routing rules by exception class — **no matching mapping** → AI gap-fill → else **suspense/holding account** + review; **irreconcilable rule conflict** → present both options in review (no auto-pick); **blocking validation** → review with the precise fix; **external service down** (VIES/NRA/bank) → proceed-with-flag or retry-with-backoff per criticality; **ambiguous reconciliation/duplicate** → human choice; **low confidence** → review (engine 10). Escalation rules raise stuck items to a senior role after thresholds; nothing is dropped.
- **Outputs:** routed work items, suspense postings (clearly marked, must be cleared before close), retries, escalations.
- **Bulgaria specifics:** VIES/NRA dependency outages handled gracefully without blocking capture.
- **Authority/priority:** exception routing never bypasses validation/compliance; suspense use is itself constrained (must be cleared before period close).
- **Failure mode:** the engine's *own* safety net — its job is to ensure no event is ever silently lost or mis-posted.

### 12. Compliance Rules
- **Purpose:** the supreme, **non-overridable** hard constraints expressing regulatory and statutory requirements.
- **Inputs:** the final proposed outcome and the action context (who, role, period, KEP status).
- **Rule logic:** veto rules that no layer (AI, user, firm, company) can override: correct **VAT treatment per ЗДДС**; **mandatory invoice fields** and **sequential numbering**; **double-entry** integrity; **no posting into a filed/locked period**; **state submissions require Approver role + KEP signature** (and preparer ≠ approver where firm policy demands); **retention** of immutable records; **audit completeness** (every action logged); **SAF-T-shaped data** preserved; **EUR functional currency** with the fixed-rate redenomination handled correctly.
- **Outputs:** permit / veto on every outcome; vetoes block emission and explain the regulatory basis.
- **Bulgaria specifics:** the entire layer is the **Bulgaria jurisdiction pack's** statutory ruleset, versioned and effective-dated; new countries add their own pack.
- **Authority/priority:** **top of the authority axis** — supreme over everything, including human and AI.
- **Failure mode:** a would-be illegal outcome is rejected with a clear, regulation-cited reason; the user is shown legal alternatives, never allowed to override the constraint.

---

## Sub-engine interaction map

```
                 ┌──────────── Recognition (3) ── period/timing
 normalized      │
 event ──────────┼── Expense Categ. (4) ─┐
                 │   Revenue Recog. (5) ──┼─▶ Posting (1) ─▶ draft entry
                 │   Fixed Asset (6) ─────┘        ▲
                 │        └─ Depreciation (7) ─ schedules
                 └── VAT (2) ── treatment/amounts ─┘
                                        │
 draft + schedules ──▶ Validation (9) ──▶ Compliance (12) ──▶ AI Override (10)
                                        │                         │
                              Exception Handling (11) ◀───────────┘
                              Period Closing (8) orchestrates 3/5/7/9 at period-end
```

Read it as: 3 sets timing; 4/5/6 (+7) and 2 feed 1 to build the entry; 9 then 12 enforce constraints; 10 decides auto vs review; 11 catches anything that can't complete; 8 drives the whole set on a schedule at period-end.

---

## Rule Versioning

Rules change — VAT rates, depreciation caps, internal policies, learned mappings. The engine treats every change as a **new immutable version**, never an edit, so historical postings remain explainable and reproducible.

- **Immutable, effective-dated versions.** Each `Rule`/`RulePack` has versions with `valid_from`/`valid_to`. A change publishes a new version; the old one is retained. Nothing is overwritten or deleted.
- **Resolve as-of the event date.** Evaluation always selects the rule version whose effective window contains the **transaction's date**, not the current date. A VAT return for May is computed with May's rules even if reviewed in June.
- **Pinned outcomes.** When a proposal is posted, the `RuleTrace` records the **exact rule versions** that produced it. A posting forever reflects the rules that were in force — re-running later cannot silently change a posted entry (it can only propose a *new* correcting entry).
- **Jurisdiction-pack versioning.** Statutory/jurisdiction rules ship as versioned packs (the Bulgaria pack). Regulatory updates (a new VAT rate, a depreciation-cap change, a SAF-T schema revision) are published as a new pack version with an effective date; companies adopt packs deliberately, and historical packs stay queryable for old periods.
- **Layered version independence.** Company/firm/learned rule versions evolve independently of the jurisdiction pack; the resolver composes the correct version of each layer for the event date.
- **Learned-rule versioning.** `CompanyLearningProfile`-derived rules are versioned snapshots too, so the engine can explain "as of this posting, the AI preferred account X because of N prior corrections."
- **Dry-run / simulation.** A new rule version can be **simulated** against historical events to preview its effect before activation (no postings produced) — critical before adopting a regulatory pack change.

---

## Rule Auditing

The engine is fully explainable: every evaluation and every rule change is on the record.

- **RuleTrace per proposal.** Each proposal carries an immutable trace: which rules **fired**, which **lost** (and why), the **versions** used, the **confidence**, and the **plain-language explanation** ("Coded to 601 because Supplier X was coded this way 7×; standard 20% VAT per ЗДДС; deductible"). This powers the Review Queue's `why?` affordance and the AI Accountant's citations.
- **Posting → rule lineage.** Every posted `JournalEntry` links to the `RuleTrace` and rule versions that produced it, completing the lineage chain: *document → extraction → suggestion → rules fired → posting*. Any figure can be explained after the fact, for an auditor or the NRA.
- **Rule-change audit.** Creating, activating, deactivating, or overriding a rule is itself an `AuditEvent` (actor — human or AI — time, before/after, rationale), in the same hash-chained, append-only trail as ledger changes.
- **Override capture.** Every human override of an AI/heuristic selection is recorded (what was proposed, what the human chose, why) — serving both audit and the learning loop.
- **Conflict/exception logging.** Irreconcilable conflicts, suspense usage, and exception routing are logged with context, so recurring rule gaps are visible and fixable.
- **Evaluation metrics.** Acceptance rates, override rates, auto-apply rates, and rule "win/loss" stats are tracked per rule/version to measure quality and detect drift (feeding the AI evaluation loop).

---

## Rule Rollback

Two distinct rollback concepts — and keeping them separate is essential, because the ledger is immutable.

### A. Rolling back a **rule** (forward-looking)
- Reverting to a prior rule/pack version means **publishing the previous version as the new active one with a new effective date** — the engine never mutates history; it changes future behavior.
- Because outcomes are pinned to the versions that produced them, rolling a rule back **does not alter already-posted entries**; it only affects evaluations of future (or re-evaluated) events.
- Rollback is gated (Approver/Admin), audited, and ideally **simulated first** to preview impact.

### B. Rolling back **outcomes the rule produced** (correcting history)
- Posted entries are **never edited or deleted**. To undo an effect, the engine proposes **reversing/adjusting entries** in an open period (the standard accounting correction), each itself validated and audited.
- If a faulty rule version posted many entries, a **controlled correction batch** is generated: reversals proposed, routed through normal review/approval (and KEP/period rules if a filed period is involved), never auto-applied silently.
- **Filed/locked periods** cannot be reversed in place — corrections flow through the audited correction/amended-return workflow (Compliance layer governs).

### C. Re-evaluation & replay
- Because rules are data and the event log is append-only/replayable, the engine can **re-evaluate** historical events under a new rule version to (i) **simulate** impact (no postings), or (ii) generate a **correction proposal set** for genuine errors — always producing *new* proposals for human approval, never rewriting the past.

### Rollback decision summary

| Situation | Action | Touches ledger? |
|-----------|--------|-----------------|
| Bad rule, nothing posted yet | Revert rule version (forward) | No |
| Bad rule, postings in an **open** period | Revert rule + generate reversing/adjusting proposals → review → post | Yes (additive reversals) |
| Bad rule, postings in a **filed/locked** period | Correction/amended-return workflow (Approver + KEP) | Yes (audited correction) |
| Preview a regulatory change | Simulate new pack version against history | No (dry-run) |

---

## Closing — how the rules engine holds together

- **One engine, twelve responsibilities,** evaluated in a single ordered, idempotent, replayable flow that selects-then-constrains.
- **Two axes:** *specificity* chooses the outcome (learned → company → template → jurisdiction → AI); *authority* validates it (compliance ▸ validation ▸ jurisdiction ▸ policy). Specificity picks; authority vetoes.
- **Deterministic before heuristic, compliance above all:** AI fills gaps and proposes, deterministic rules win ties, and statutory rules can veto anyone — including a human and the AI.
- **Rules are versioned, effective-dated data:** outcomes resolve and pin to the rules in force on the event date, so history is always explainable and reproducible; regulatory change is a pack update, not an engineering project.
- **Everything is traced and reversible-forward:** every proposal carries a rule trace, every rule change is audited, and rollback changes *future* behavior or produces *additive* corrections — never mutating the immutable ledger.
- **The engine never acts alone:** it proposes; humans approve; only approved facts post; nothing reaches the state without explicit approval and KEP.

This rules engine is the connective tissue between the document/intelligence layer that captures events and the immutable ledger and compliance layers that record and file them — encoding Bulgarian accounting and tax logic as governed, versioned, auditable configuration, and leaving expansion to new jurisdictions a matter of adding a pack, not rebuilding the brain.

*End of v1.0 Accounting Rules Engine architecture.*
