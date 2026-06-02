# AI_ACCOUNTING_PLATFORM_MASTER_v1.md

**Single source of truth — consolidated from the 11 project documents (v1.0).**
**Status:** production-ready baseline · **Market:** Bulgaria-first, EU-expandable · **Scope:** consolidation only (no new requirements).

> This document holds the **final decisions**. The eleven source documents (listed in §0.3) remain the **detailed references**; where this master and a source doc ever disagree, this master wins. Detailed wireframes, full entity catalogs, and exhaustive sub-sections live in the source docs.

---

## 0. Document Control

### 0.1 How to use this document
- **Engineers / Claude Code:** read §A (Core Invariants) and §16 (Claude Development Rules) first — they govern everything. Then the domain section you're building, then the matching source doc for depth.
- **Product / leadership:** §1–§4 (vision, scope, MVP) and §15 (roadmap).
- **Security / compliance:** §A, §14 (security), §13.5 (residency), §2 (regulatory anchors).

### 0.2 What changed in consolidation
Duplicate material (multi-tenancy, EU residency, immutable ledger, EUR/BGN, AI-proposes-never-commits, human-in-the-loop) was **merged into §A Core Invariants** and referenced rather than repeated. Stack comparisons were collapsed to the **chosen option** + one-line rationale.

### 0.3 Source documents (detailed references)
1. Master Architecture · 2. UX Architecture · 3. Design System · 4. Screen Specifications · 5. Domain Model & Data Architecture · 6. Accounting Rules Engine · 7. AI Architecture · 8. Backend Architecture · 9. Frontend Architecture · 10. Infrastructure & DevOps · 11. MVP Scope & Roadmap.

---

## A. Core Invariants (the non-negotiables — true across every layer)

These are the decisions that recur everywhere and may never be violated:

1. **Tenant isolation is absolute.** Every entity is `tenant_id`-scoped (company-scoped below that). **PostgreSQL Row-Level Security** is the guaranteed backstop beneath application checks. No relationship, query, job, log, cache, search index, or AI retrieval ever crosses `tenant_id`. A cross-tenant access is a **sev-1**.
2. **The ledger is immutable.** Posted double-entry journal entries are append-only; **corrections are reversing entries, never edits/deletes**. Every entry balances (Σdebit = Σcredit).
3. **The audit trail is append-only and hash-chained.** Every sensitive action (incl. AI actions) is recorded with actor, before/after, reason, timestamp — tamper-evident, immutable.
4. **AI proposes; it never commits.** AI may read scoped data and emit suggestions/extractions only. It **can never post to the ledger, file to NAP, sign with KEP, or change permissions** — enforced by capability-limited identity, not convention.
5. **Human-in-the-loop for money and the state.** Nothing reaches the ledger or the government without explicit human approval; state submissions also require an Approver role + KEP. (MVP: no AI auto-posting at all.)
6. **Deterministic over probabilistic.** Anything checkable (EIK, VIES, IBAN, net+VAT=total, VAT correctness, double-entry) is decided by deterministic validators/rules, which outrank any AI output.
7. **EU-resident, zero-retention.** All data, processing, backups, logs, and AI/OCR endpoints are EU-only; AI vendors operate under zero-retention/no-training terms; customer data never trains shared models.
8. **EUR is functional currency; BGN is legacy.** Money is exact decimal (never float). Fixed rate **1 EUR = 1.95583 BGN**. **Dual EUR+BGN display until 8 Aug 2026**, then config-switchable.
9. **Permissions in the UI are UX hints, not security.** The backend re-authorizes every action; the frontend assumes a shown control can still be denied.
10. **Secrets never in code; production data never copied unmasked to lower environments.**

---

## 1. Vision

An **AI-powered accounting platform** that automates **80–90%** of accounting, tax compliance, document processing, and reporting for **small businesses, freelancers, micro-enterprises, and the accountants/firms that serve them** in **Bulgaria**, expandable to other EU countries.

**It is explicitly NOT an ERP** and not for large enterprises. The differentiator is an **intelligent, explainable, compliant** layer that ingests documents, proposes accounting and VAT treatment, and answers questions — always under human control.

**North star:** *trust through transparency* — every figure traces to a source document, every AI action is explainable and cited, nothing is filed to the state without human approval, and every change is audited.

**Two primary operating modes from one codebase:** **self-serve** (owner/freelancer) and **firm mode** (accountant managing many client companies). The data hierarchy that enables both: **Tenant → Organization → Company → Fiscal Year → Period**.

---

## 2. Bulgarian Regulatory Anchors (decided facts as of 2026)

These shape scope and phasing and are treated as fixed inputs:

| Anchor | Decision/impact |
|--------|-----------------|
| **Euro adoption (1 Jan 2026)** | EUR is functional currency; BGN legacy at fixed **1.95583**; **dual display mandatory until 8 Aug 2026**; redenomination boundary at the 2025/2026 year-end. |
| **SAF-T** | Phased: large enterprises from 2026, widening to ~all by ~2030. **Target users not yet in scope.** Data is **SAF-T-shaped** now; **no SAF-T export in MVP**. |
| **B2B e-invoicing** | Still **voluntary** (post-audit) in 2026; B2G mandatory. Clearance/real-time model expected later (~2028–2030, likely UBL/Peppol). Invoicing built behind a pluggable adapter. |
| **VAT** | Standard **20%**, reduced **9%**, zero/exempt, reverse-charge, intra-EU. All rates **data-driven and effective-dated**. Monthly period, filing by the **14th**. |
| **Filing/signing** | Via the NRA (НАП) portal with **KEP** (qualified e-signature). **MVP manualizes this** — export files, user files on the NRA portal. |

---

## 3. Product Scope (full vision — phased)

**Core modules** (full platform): Company Management · Clients & Suppliers · Sales & Invoicing · Document Management · OCR & Document Intelligence · AI Accounting Engine · VAT Module · Accounting/Ledger Engine · Bank Reconciliation · Receivables & Payables · Client Portal · NAP Integration · KEP Signing · SAF-T Engine · AI Accountant · Audit Trail.

**Capability spine:** Capture → Validate → Classify → Post → Reconcile → Report → Comply → Advise.

**Languages:** Bulgarian default + English; multilingual UI, invoices, reports, notifications; built for future countries (locale **+** jurisdiction-pack separation).

**Design intent:** modern, banking-grade, minimal, trustworthy — white / light-blue / green palette; Cyrillic-first.

*(Detailed module behavior: source docs 1, 5. This master keeps the decided scope; §4 defines what ships when.)*

---

## 4. MVP Scope (what actually ships first)

**MVP one-liner:** *A Bulgarian-first web app where a small business or accountant uploads documents, AI extracts the data, a human reviews & approves, and correct immutable accounting entries + VAT registers + basic reports come out — with VAT files exported for manual NRA filing.*

**The core loop (the entire MVP):** `upload document → AI extracts → human reviews → approves → immutable double-entry posting → basic VAT registers + reports`.

### 4.1 IN scope (MVP)
- **Foundation (production-grade):** multi-tenant + **RLS**; **immutable ledger + double-entry**; **append-only audit**; auth + MFA; EU hosting; encryption; encrypted, restore-tested backups; **multi-company + switcher** (minimal firm UI).
- **Master data:** company setup (EIK + VAT status); counterparties (+EIK/VIES); **Bulgarian chart of accounts**; VAT codes (20/9/0/exempt/RC/intra-EU).
- **Core loop:** document upload → EU immutable storage → **managed OCR/Document-AI extraction (EU, zero-retention)** → deterministic validation (EIK/VIES/IBAN/sum/duplicate) → **simple rules** (VAT determination + posting suggestion via template + per-counterparty memory + LLM gap-fill) → **Review Queue** (human approve/correct/reject, **no auto-post**) → **immutable posting**.
- **Sales (basic):** **invoice issuance** (invoice type only) → post + PDF + email; sequential numbering.
- **VAT & reporting (basic):** purchase/sales registers; VAT return view + Validation Center; **export files for manual NRA upload**; trial balance, simple P&L, registers (view + export).
- **Language/money:** Bulgarian UI (i18n-scaffolded), Cyrillic-correct, EUR primary + BGN reference.

### 4.2 OUT of scope (MVP → later phases)
Direct NAP submission · in-app KEP signing · SAF-T · AI CFO/forecasting/recommendations · AI auto-posting · AI Accountant chat · bank reconciliation · client portal · firm cockpit · credit/debit notes & proforma · fixed assets/depreciation/recognition/period-close automation · the full 12-sub-engine rules engine · email-in capture · notifications (beyond minimal) · English UI · native mobile/advanced PWA · anomaly detection & the full learning loop.

### 4.3 Manualize / fake in MVP
NAP filing (export → user uploads to NRA portal) · KEP (user signs on the portal) · SAF-T (none) · auto-posting (human review) · learning (per-counterparty memory) · onboarding (concierge) · client portal (email) · bank rec (manual/none) · firm cockpit (company list + switcher).

### 4.4 Must be production-grade from day one
RLS tenant isolation · immutable double-entry ledger · append-only audit · money/VAT correctness (decimals, effective-dated, EUR/BGN) · auth+MFA+encryption+secrets+EU residency · encrypted restore-tested backups · human-in-the-loop postings · EU/zero-retention AI. *(= §A invariants.)*
ENDOFDOC
echo "part1 done"; wc -l /home/claude/master.md
---

## 5. System Architecture

**Style:** **modular monolith** (one deployable, modules = bounded contexts) + independently scaling **queue workers**, **decomposable later** along the AI / Reporting / Compliance seams.

**Five product layers:** Capture → Intelligence → **Ledger (single source of truth)** → Compliance → Engagement. Strict rule: **Intelligence proposes; humans approve; only approved facts enter the immutable ledger; Compliance reads from the ledger.**

**Bounded contexts / modules:** Identity · Tenancy · MasterData · DocIntel · Invoicing · Ledger · Tax · Compliance · Banking · Reporting · Audit · Notification (+ AI Gateway, Platform infra). Communication: **in-process** for synchronous consistency, **domain events via transactional outbox** for decoupled reactions. No module touches another's tables.

**Multi-tenancy:** shared database, shared schema, **RLS** isolation on `tenant_id`/`company_id`; large tenants promotable to a dedicated DB/residency via a `placement` attribute (no code change).

**Hosting:** single EU region (Frankfurt), multi-AZ; EU-resident everything (§13).

---

## 6. UX Architecture

**Three shells over a shared App Shell:**
- **App Shell:** top bar (logo · **company switcher** · global search · `+ Capture` · notifications · **BG|EN** · account) + collapsible left nav rail (count badges) + content + persistent **AI launcher**.
- **Firm Shell:** multi-client cockpit (dashboard, clients, cross-client work queue, deadlines, reports, team, billing). *(MVP: minimal — company list + switcher.)*
- **Company Workspace:** single-company modules (Documents, Review, Sales, Purchases, Banking, Accounting, VAT, Compliance, Receivables/Payables, Reports, AI Accountant, Audit, Settings).
- **Client Portal:** minimal, single-company, jargon-free (upload, reports, archive, notifications). *(MVP: excluded.)*

**Seven UX principles:** capture-first · review-don't-re-enter · explain-everything (confidence + why + source link) · human-holds-the-pen for money/state · progressive disclosure (Simple⇄Expert) · banking-grade calm · deadline-aware.

**Signature screen:** the **AI Review Queue** — list (confidence-sorted, bulk-eligible only for high-confidence/flag-free) + single-item work surface (document viewer ↔ extracted fields + AI suggestion + duplicate flag → approve/correct/reject; keyboard-first A/E/R/→).

**Dashboards:** Company (deadline strip → KPIs → attention list → risk feed/activity) · Accountant (personal cross-client work queue) · Firm (practice risk/deadlines/capacity) · Client portal (status + send + reports).

**Core flows:** document→posted-entry; invoice issue; VAT close→export (MVP) / →sign→file (later); firm client onboarding; AI Q&A. Screen catalog & wireframes: source docs 2, 4.

---

## 7. Design System

**Brand:** trustworthy, clear, intelligent, professional, effortless, local+European. Voice: clear, warm, professional; AI tone humble and cited.

**Tokens (two-tier: primitive → semantic; components use semantic only).**
- **Palette:** white surfaces; **light-blue primary** (`blue-500 #2F7BE0`, tints `#D6E8FC/#EEF5FE`, text on white `blue-600/700`); **green success** (`#16A463`); **neutral** text `#12161C`; **amber warning** (icon `#E39B12`, text `amber-600 #9A6406`); **error red** (`#CB2A2A`). Status always = icon + text + color (never color alone). 60-30-10; red/amber reserved for risk/error/deadline.
- **Typography:** Cyrillic-first sans (e.g. Inter / IBM Plex Sans) with **Bulgarian `locl` letterforms enabled** and **`tnum` tabular figures on all money**; scale: Display 36 / H1 28 / H2 22 / H3 18 / Body 14 / Caption 12; sentence case; design for BG/EN length variance.
- **Spacing:** 4px base (4/8/12/16/24/32/48/64). **Radius:** 6 controls / 8 cards / 12 modals. **Grid:** 12-col desktop, 240/64 nav rail, 56 top bar, 1200 max content. Breakpoints mobile<640 / tablet / desktop / wide.

**Key components (decided set):** Button incl. **Commit variant** (NAP/KEP, with confirmation summary) · form fields incl. **MoneyField** · **DualCurrencyAmount** (EUR primary + BGN ref, currency mode) · **VatSelector** · **AccountPicker** · tables (tabular figures, right-aligned, drill-down) · **ConfidenceBadge** (≥90 🟢 / 70–89 🟠 / <70 🔴; deterministic = **Validated ✓**, no %) · StatusChip · document/review/invoice/dashboard/AI/NAP-KEP/mobile domain components.

**Universal states:** loading (skeletons) · empty (first-use/filtered/all-clear) · error (field→form→banner→toast→page; never lose input) · permission-denied · offline.

**Figma-to-code:** tokens are the single source of truth (names+values match Figma Variables); modes for light/dark/white-label and **currency dual/single**; Storybook + visual regression in BG **and** EN. Accessibility: **WCAG 2.1 AA**.

---

## 8. Domain Model

**Spine:** `Tenant → Organization → Company → FiscalYear → AccountingPeriod`, with master data referenced and everything feeding into or derived from the **immutable ledger**.

**Conventions (all entities):** tenant/company-scoped; posted ledger + signed artifacts + audit are **append-only ⊕**; reference data (VAT rates, VAT registration, exchange rate) is **effective-dated ⏱** (resolve as-of the event date); money = exact decimal + currency (+ EUR-equiv + rate for legacy/foreign); surrogate keys; soft-delete only for drafts (never for posted/filed).

**Key aggregates (decided):**
- **Ledger:** `JournalEntry ◆⊕` + `JournalLine ⊕` (balanced, immutable, reversal-only) · `AccountingPeriod` (open→locked) · `Account ⏱` (BG chart, classes 1–7) · `LedgerBalance`/`TrialBalance` (projections).
- **Tax:** `TaxCode ⏱` · `CompanyVatRegistration ⏱` · `VatPeriod` · `VatLedgerEntry ⊕` · `VatReturn ◆` · `ViesDeclaration` · `VatValidationIssue`.
- **DocIntel:** `Document ◆` (+`DocumentVersion ⊕`) · `Extraction ◆`/`ExtractedField` · `AISuggestion ◆`/`AIFeedback ⊕`/`CompanyLearningProfile` (tenant-isolated) · `ReviewItem`.
- **Invoicing:** `SalesDocument ◆` (+`InvoiceLine`, `NumberingSeries` gapless) · `Payment`/`Receivable`.
- **Compliance:** `NapSubmission ◆` (+`SubmissionArtifact ⊕`/`Confirmation`) · `SafTExport`/`SafTSchemaVersion` (ACL) · `Signature ⊕`/`Certificate`.
- **Banking:** `BankAccount`/`BankStatement ◆`/`BankTransaction ⊕`/`ReconciliationMatch`.
- **Identity/Tenancy:** `User ◆`/`Membership`/`CompanyAssignment(role)`/`Role`/`Permission`/`Session` · `Tenant ◆`/`Organization`/`Company`/`Subscription`/`Entitlement`/`UsageMeter`.
- **Cross-cutting:** `AuditEvent ⊕` (hash-chained; AI = named actor) · `DomainEvent ⊕` (outbox) · `Notification` · `RetentionPolicy ⏱`/`LegalHold`/`ErasureRequest`.

**Invariants:** double-entry balance; no posting into a locked period; lineage `document → extraction → suggestion → rules → posting`; tenant isolation; effective-dated treatment. Full entity catalog: source doc 5.

---

## 9. Accounting Rules Engine

**Rules are data, not code** — declarative, versioned, effective-dated, editable without deploys. The engine **proposes** (never writes the ledger); **deterministic before heuristic; compliance above all**.

**Two-axis hierarchy:**
- **Specificity (selects the outcome):** learned (counterparty) > company config > industry template > jurisdiction default > **AI gap-fill (lowest)**.
- **Authority (vetoes):** Compliance ▸ Validation invariants ▸ Jurisdiction constraints ▸ firm/company policy. **Compliance is supreme — non-overridable by AI or human.** Specificity picks; authority validates.

**Execution flow:** normalize → resolve rules as-of event date → recognition (period/timing) → select mappings → calculate (VAT/amounts/schedules) → validate → compliance gate → AI-override decision → emit **Proposal + RuleTrace**. Idempotent, replayable.

**Twelve sub-engines:** Posting · VAT · Recognition · Expense Categorization · Revenue Recognition · Fixed Asset · Depreciation · Period Closing · Validation · AI Override · Exception Handling · Compliance. *(MVP uses only **VAT + Posting + Validation**; the rest are Phase 2/3.)*

**Versioning/audit/rollback:** outcomes **pin** the rule/model/prompt versions used (history reproducible); every rule change audited; **rolling back a rule is forward-looking** (never mutates history); correcting outcomes = **additive reversing entries** (filed periods → amended-return workflow). Bulgaria specifics (VAT treatments, tax-depreciation caps) are **effective-dated config in the jurisdiction pack**, not hard-coded. Detail: source doc 6.

---

## 10. AI Architecture

**Four subsystems (none can commit):** Document Intelligence (read/extract) · Accounting Automation (suggest postings/VAT/categorization; deterministic-first + LLM gap-fill) · Conversational AI (AI Accountant; AI CFO — Phase 2/3) · Learning & Quality.

**Document pipeline (async, idempotent):** ingest (immutable + hash) → route (XML native-parse vs document path) → classify → **OCR/Vision-LM** read → extract fields+lines (+confidence+location) → **deterministic validate** → suggest → gate → emit + trace.

**Task routing (decided):** OCR/Vision-LM = read scanned docs + extract; **native parse** = XML (no OCR); **LLM** = normalization, classification, categorization/VAT-ambiguity gap-fill, anomaly narration, chat; **deterministic only** = EIK/VIES/IBAN/sum/double-entry/VAT-rate/period; **forecasting** (CFO) = statistical, not LLM.

**Confidence:** **Validated ✓** (deterministic fact, no %) vs **confidence %** (calibrated; ≥90/70–89/<70). Drives review order + auto-apply eligibility. Figures from the ledger carry no confidence.

**Human-in-the-loop / auto-apply:** review is the default; **auto-apply only** when High confidence + low risk + opted-in + validation/compliance clean + no conflict — **never** for state actions; **MVP has no auto-posting**.

**Learning:** corrections → `AIFeedback` → tenant-isolated `CompanyLearningProfile` / per-counterparty rules; **customer data never trains shared models** (preference/rule adaptation only).

**RAG (Accountant/CFO):** retrieve from the company's own ledger/docs (tenant-scoped) + the **versioned Bulgarian tax KB**; **figures only from the ledger**; **citations required**; **abstain when unsupported**.

**Safety:** all document/extracted/user content is **data, not instructions** (document-borne prompt-injection defense); AI runs under a **capability-limited identity** with no privileged actions; everything traced (model/prompt version) and audited with AI as a named actor. EU + zero-retention; strict tenant isolation of retrieval/learning/embeddings/cache. Detail: source doc 7.

---

## 11. Backend Architecture

**Stack (decided):** **NestJS (TypeScript) core + Python workers for AI/OCR + PostgreSQL (RLS, replicas, partitioning) + Redis/BullMQ + EU S3-compatible storage.** Rationale: bounded-context fit, end-to-end TS with the frontend, clean AI isolation, team velocity. *(Fallback if Python-first: FastAPI/Django + Celery.)*

**Shape:** modular monolith + independently scaling workers; **transactional outbox** for events; reads from **projections/read models** (CQRS-lite, never live-aggregate the ledger); files in EU object storage.

**Tenant enforcement (3 layers):** application context → **RLS backstop** (per-request **`SET LOCAL` tenant/company** under transaction-pooling; app role is non-bypass; fail closed on missing context; workers re-apply context) → connection discipline. **RLS isolation tests are release-blocking.**

**Authority:** privileged commit services (post, file, sign, change-permissions) are role-gated + step-up + audited, and **physically unreachable by AI workers** (capability-limited identity).

**Key workflows:** upload (signed-URL direct-to-storage + malware scan + idempotent) · OCR/AI worker (capability-limited) · **ledger posting** (balanced, immutable, audit + outbox in one txn) · VAT (assemble from postings → registers/return/validation/export) · NAP/KEP (ACL, human-gated, MVP-manual) · banking · invoicing (gapless numbering). Auth: email+pw+MFA, KEP step-up; RBAC + ABAC with non-overridable guardrails.

**Queues/workers (independent):** OCR · AI · reports · SAF-T · submissions · bank-import · notifications · indexer — autoscaled on queue depth, retries+DLQ+idempotency, per-tenant fairness. Detail: source doc 8.

---

## 12. Frontend Architecture

**Stack (decided):** **Next.js (App Router) + React + TypeScript + Tailwind(tokens) + TanStack Query + TanStack Table + React Hook Form/Zod + next-intl + Storybook/Playwright**, EU-hosted. Rationale: TS-with-NestJS + shared contracts, one tool for marketing/auth/app, nested layouts = the three shells, built-in BG/EN locale routing, route handlers as a thin BFF. *(Fallback: Vite + React SPA.)*

**Rendering:** marketing SSG · auth SSR · **authenticated app primarily client-rendered** (RSC for shell/first-paint only); BFF route handlers hold httpOnly-cookie sessions and call the NestJS API.

**Routing → shells:** nested layouts implement Firm (`/firm/*`), Company Workspace (`/c/[companyId]/*`), Client Portal (`/portal/[companyId]/*`); company switch = route change preserving the module sub-path; filters/period/tab in the URL; command palette.

**State (categorized):** **server state → TanStack Query** (namespaced by tenant/company; invalidate on mutation/event; optimistic where safe; cursor pagination; idempotency keys) · session/identity context · UI state (Zustand) · navigable state (URL) · forms (RHF+Zod mirroring backend rules). No mega-store.

**Real-time:** SSE/websocket for review queue, notifications, processing status; AI chat streams via SSE.

**Heavy surfaces:** DocumentViewer (lazy, sandboxed, signed-URL, field-highlight overlay) · Review Queue (keyboard-first, optimistic) · Invoice builder (live dual-currency totals) · data grids (virtualized, drill-down) · VAT/compliance steppers (gated state machines, Commit confirmations).

**i18n & money:** **BG default**, Cyrillic-first (`locl`), externalized strings, fallback chain; **EUR primary + BGN reference** via shared Intl-based components + currency mode. **Permissions = UX hints only** (handle backend 403 gracefully). WCAG 2.1 AA; code-split/virtualized/lazy; PWA capture (Phase-dependent). Detail: source doc 9.

---

## 13. Infrastructure & DevOps

**Cloud (decided):** **AWS EU (Frankfurt, eu-central-1), multi-AZ, for MVP.** Rationale: S3 **Object Lock (WORM)** for immutability, RDS/Aurora **PostgreSQL with RLS**, managed Redis/queues/KMS/Secrets/OpenSearch/WAF; portable design (containers + Postgres + S3-compatible + Redis + OpenTelemetry) preserves a path to an EU-sovereign provider. *(Co-leader: Azure EU, esp. for Document Intelligence OCR.)*

- **13.1 Topology:** CDN/WAF/DDoS → LB → stateless app tier (modular monolith) + **independently scaling worker fleets**; private data subnets (Postgres, Redis, storage, search); controlled egress to **EU-only** approved endpoints.
- **13.2 Environments:** dev · staging (prod-like) · production, fully isolated; **no unmasked prod data in lower envs** (synthetic/anonymized).
- **13.3 Data:** managed PostgreSQL (RLS, multi-AZ, read replicas, partitioning, pgvector) + connection pooling; Redis (HA) + BullMQ queues; **S3 with Object Lock + SSE-KMS + versioning + lifecycle tiering**, no public buckets, signed URLs, tenant-prefixed keys.
- **13.4 Pipeline & IaC:** Terraform/OpenTofu (remote encrypted state, **policy-as-code enforcing EU-region/no-public-buckets/encryption**); CI/CD: build → tests (incl. **RLS + ledger + VAT**) → security scans (SAST/DAST/dep/secret/image) → staging → gated prod **blue/green**; **expand/contract DB migrations**; signed images + SBOM.
- **13.5 Residency/GDPR:** EU-only data/processing/backups/logs/AI; sub-processor DPAs + **zero-retention**; DSAR/erasure reconciled with retention + legal holds; DPIA; GDPR 72-h breach process.
- **13.6 Resilience:** multi-AZ + EU cross-region DR; **encrypted, restore-tested backups**; rebuildable projections; RPO/RTO defined.
- **13.7 Observability:** OpenTelemetry; metrics/traces/**PII-free structured logs** (distinct from the audit trail); SLOs; alerts (errors, queue depth, security signals, cost, failed backups, expiring certs, compliance-pipeline). Detail: source doc 10.

---

## 14. Security (consolidated)

Built on §A invariants; defense-in-depth, zero-trust, least privilege.

- **Isolation:** RLS backstop + tenant context on every request/job/log/storage-key/index/cache/vector; cross-tenant access = sev-1; isolation tests gate releases.
- **Identity/access:** auth + **mandatory MFA** (staff), **KEP step-up**; **RBAC + ABAC** with **non-overridable guardrails** (state submission needs Approver + KEP; permission changes Admin-only; last-admin protection). **AI identity is capability-limited** — no ledger/NAP/KEP/permission access.
- **Data protection:** TLS everywhere; encryption at rest (DB, replicas, backups, Redis, storage, search) via **KMS** + rotation; field-level encryption for the most sensitive identifiers; **secrets in a vault, never in code/images** + rotation + CI secret-scanning. **KEP private keys never held.**
- **App/input hardening:** OWASP Top 10; malware scan + **sandboxed parsing** (XXE/ZIP-bomb/macro defenses); **document-borne prompt-injection defense** (content = data, not instructions); WAF + DDoS + rate limiting; signed images/SBOM/dependency scanning; periodic pen tests.
- **Auditability:** append-only, hash-chained audit of all sensitive actions + auth decisions + admin/impersonation (time-boxed, justified, tenant-scoped, audited; **no standing god-mode**).
- **Posture:** **ISO 27001-ready**; EU residency; immutable ledger + audit as evidentiary controls. *(Production-readiness checklist: source doc 10 §31.)*

---

## 15. Roadmap

**Doctrine:** ship **one loop**, not a platform; **buy the ML** (vendor OCR), **build the correctness**; **manualize compliance** (NAP/KEP/SAF-T); **human-in-the-loop always**; vertical slices; two people move fast by saying no.

**Phase 1 — MVP (~90 days, pilot-ready for 3–5 design partners):** the core loop end-to-end (§4), built as 6 vertical slices.
- **Day 30 — spine standing:** repo + CLAUDE.md + EU infra skeleton; **RLS + immutable ledger + audit + auth**; upload → extract visible.
- **Day 60 — core loop closes:** master data + simple rules (VAT/posting/validation) + **Review Queue** + **immutable posting** + purchase register.
- **Day 90 — sellable wedge:** basic invoicing + VAT return + **export for manual filing** + reports + company switcher + BG polish + harden + onboard pilots.

**Build order (dependency, as slices):** Tenancy/RLS → Identity → **Ledger+Audit** → MasterData → DocIntel → Rules(simple) → Invoicing → Tax/VAT → Reporting → minimal Notification + multi-company UI.

**Phase 2 (~months 4–9):** bank reconciliation · AI Accountant chat + learning loop · gated AI auto-apply · client portal + firm cockpit · credit/debit notes + proforma · **KEP signing + direct NAP submission** · **SAF-T export** · English · notifications · anomaly/risk + Recommendations Center · richer reports.

**Phase 3 (~9–18 months):** AI CFO + proactive compliance · fixed assets/depreciation/recognition + period-close automation · e-invoicing/real-time reporting when mandated · **multi-jurisdiction** (new pack + locale) · service extraction (AI/Reporting/Compliance) + multi-region DR · ISO 27001 certification.

**Testing (MVP-appropriate):** property-based **ledger invariants** · release-blocking **RLS isolation** · **VAT golden cases** · manual **extraction eval** · core-loop **e2e** · validation + security smoke. Detail: source doc 11.

---

## 16. Claude Development Rules

The operating contract for building with Claude Code (two people, token-conscious). **This section governs day-to-day work.**

### 16.1 Ground rules
- **Honor §A Core Invariants in every change.** RLS, immutable ledger, append-only audit, AI-proposes-never-commits, human-in-the-loop, deterministic-over-AI, EU/zero-retention, EUR/BGN, permissions-as-UX-only, secrets-not-in-code, no-unmasked-prod-data — these are non-negotiable acceptance criteria.
- **This master + the 11 source docs are the source of truth.** Point Claude Code at a doc section ("per §9 / Rules-Engine doc") instead of re-describing — saves tokens.
- **Build foundations first and don't churn them:** Tenancy/RLS → Identity → Ledger+Audit → Auth, **before** anything writes data. Re-deciding the data model later is the costliest mistake.
- **Vertical slices, not horizontal layers:** one feature end-to-end (DB→backend→AI→frontend→tests), one reviewable PR.
- **You own the safety-critical reviews** (ledger, RLS, VAT) — read that code; don't rubber-stamp.

### 16.2 Token economy
- Maintain a repo **`CLAUDE.md`** = stack + conventions + §A invariants + an index to `/docs` (the 11 source docs + this master). Claude reads it every session, so the architecture is never re-explained.
- **One scoped task per prompt;** small PRs; commit often; keep the working tree coherent. Avoid mega-prompts and re-litigating settled decisions.
- Let Claude Code write tests with each slice; **you supply the ledger/RLS/VAT test cases**.

### 16.3 Build constraints (MVP)
Stack = **NestJS + Python AI workers + Next.js + PostgreSQL/RLS + Redis/BullMQ + AWS EU(Frankfurt) + S3 Object-Lock**. **No** auto-posting, **no** in-app NAP/KEP/SAF-T, **no** AI CFO/chat (MVP), **no** bank rec/client portal/firm cockpit (MVP). OCR = **managed EU/zero-retention vendor** (validate accuracy before committing). BG-first, i18n-scaffolded. Money = exact decimals; EUR primary + BGN ref.

### 16.4 Prompt sequence (ordered, one scoped PR each)
1 repo + CLAUDE.md · 2 modular-monolith skeleton (modules=contexts) · 3 **tenancy + RLS + context wiring + isolation tests** · 4 **immutable ledger + double-entry + append-only hash-chained audit + invariant tests** · 5 auth/MFA + RBAC/ABAC · 6 App Shell + auth/onboarding (BG/Cyrillic/EUR-BGN/tokens) · 7 MasterData (company/EIK, counterparties/VIES, BG chart, VAT codes) · 8 document upload (signed-URL→EU storage, immutable) + malware scan · 9 OCR/extraction worker (EU vendor, capability-limited, native-XML path) · 10 simple rules (VAT + posting + validation → proposal+trace) · 11 **Review Queue** (viewer+fields+suggestion+duplicate; approve/correct/reject; store feedback) · 12 approval→**immutable posting** + purchase register + audit · 13 invoice issuance (numbering→post→PDF→email; sales register) · 14 VAT (assembly→return→validation→**export**, no submission) · 15 reports (trial balance/P&L/registers) · 16 company switcher + minimal dashboard + BG pass · 17 CI/CD + light Terraform (EU) + backups + monitoring + PII-redacted logs · 18 core-loop e2e + VAT golden cases + extraction eval · 19 **production-readiness checklist** · 20 harden + feature-flag edges + concierge onboarding.
*(Keep prompts 3–5 — RLS, ledger, audit, auth — before anything writes data.)*

---

## Appendix — Glossary

**НАП/NAP/NRA** National Revenue Agency · **ЕИК/EIK** company ID · **КЕП/KEP** qualified e-signature (eIDAS) · **ЗДДС** VAT Act · **Справка-декларация** VAT return · **Дневник на покупки/продажби** purchase/sales VAT registers · **VIES** EU VAT validation · **SAF-T** Standard Audit File for Tax (phased, not in MVP) · **НСС/NSS** National Accounting Standards (IFRS alt.) · **QTSP** qualified trust service provider (KEP issuer) · **RLS** Row-Level Security · **WORM** write-once-read-many (object lock) · **ACL** anti-corruption layer · **Fixed rate** 1 EUR = 1.95583 BGN (dual display until 8 Aug 2026).

---

## Closing — the one-paragraph truth

Build a **Bulgarian-first, EUR-native, design-system-faithful, EU-resident** accounting platform whose entire MVP is one trustworthy loop — **upload → AI extracts → human reviews → approves → immutable double-entry posting → VAT registers/reports (exported for manual NRA filing)** — on a **modular-monolith NestJS + Python-AI-workers + Next.js + PostgreSQL-with-RLS** stack, where **tenant isolation, the immutable ledger, the append-only audit, and human control of money and the state are sacred and production-grade from day one**, and **everything else is faked, deferred, or phased**. The AI **proposes and explains, never commits**. This document is the contract; the eleven source docs are the depth; §A and §16 govern the work.

*End of AI_ACCOUNTING_PLATFORM_MASTER_v1.*
