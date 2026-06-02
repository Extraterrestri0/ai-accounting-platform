# AI Accounting Platform — Master Architecture & Product Design

**Document type:** Foundational architecture specification (architecture only — no code, schema, or APIs)
**Market:** Bulgaria (primary), EU expansion-ready
**Audience:** Founders, engineering leadership, product, compliance, investors
**Status:** v1.0 — baseline for the entire project

---

## 0. Executive Summary & 2026 Regulatory Context

### 0.1 What we are building

An intelligent, multi-tenant SaaS accounting platform that automates 80–90% of the accounting workflow for small businesses, freelancers, self-employed professionals, micro-enterprises, and the accounting firms that serve them. The differentiator is not feature breadth (this is deliberately *not* an ERP) but an AI layer that ingests documents, proposes accounting and VAT treatment, detects risk, and answers natural-language questions — always under human review.

### 0.2 The product is built around two distinct primary personas

The single most important architectural decision is recognising that the platform serves **two operating modes from one codebase**:

1. **Self-serve mode** — a freelancer or micro-business owner doing their own books with heavy AI assistance.
2. **Firm mode** — an accountant or accounting firm managing tens to hundreds of *client* companies from a single cockpit.

These modes share the same accounting core but require different navigation, dashboards, permission models, and bulk-operation tooling. The data model is therefore hierarchical: **Account (tenant) → Organization → Company → Fiscal Year → Ledger**. A firm is simply a tenant that owns many companies; a freelancer is a tenant that owns one. This avoids building two products.

### 0.3 Critical 2026 Bulgarian regulatory context (this shapes the entire build)

This architecture is designed for the regulatory reality of mid-2026, not 2024. Three forces dominate:

**a) Bulgaria is now in the euro area.** Bulgaria adopted the euro on 1 January 2026 at the fixed, irrevocable rate **EUR 1 = BGN 1.95583**. Implications baked into the architecture:
- The system's functional/base currency is **EUR**.
- **BGN is a legacy currency**: all historical data (pre-2026) is in BGN and must be preserved, displayed, and convertible at the fixed rate.
- **Dual price display (BGN + EUR) is mandatory until 8 August 2026** — invoices, catalogues, and customer-facing documents need a dual-display capability that can be switched off after that date by configuration, not redeployment.
- A clean **currency redenomination boundary at 31 Dec 2025 / 1 Jan 2026** must exist in the ledger so that comparatives and trial balances straddle the changeover correctly.

**b) SAF-T is arriving in phases.** Bulgaria's NRA (НАП) mandates Standard Audit File for Tax reporting starting **January 2026 for large enterprises only** (~460 companies above BGN 300M revenue / BGN 3.5M tax thresholds), expanding through ~2028 to medium/small enterprises and reaching effectively all taxpayers by ~2030. The reporting cadence is **monthly accounting + invoices (due by the 14th of the following month), annual fixed assets (due 30 June), inventory on demand**, all submitted electronically and signed with a qualified electronic signature. **Our target users (micro/freelancers) are NOT yet in scope**, but the data model must be SAF-T-shaped from day one so that when the obligation reaches them, it is a configuration/export step, not a re-architecture. The schema is a moving target (the NRA reissued technical documentation in 2025 and amended it again in early 2026), so the SAF-T engine must treat the schema as **versioned and externally configurable**.

**c) Mandatory e-invoicing is coming but is not here yet.** As of 2026, B2B e-invoicing in Bulgaria remains **voluntary** (post-audit model); B2G e-invoicing is mandatory under EU public-procurement rules. The NRA is in public consultation on a future clearance/real-time-reporting model (commonly expected to align with EU ViDA toward 2028–2030, likely UBL 2.1 XML). The architecture therefore treats invoice issuance as an internal event that can later be routed through a **pluggable "fiscalization/clearance" adapter** without changing the invoicing UX.

**d) VAT baseline.** Standard VAT rate 20%, reduced 9% (e.g. hospitality), 0%/exempt categories, reverse-charge and intra-EU rules. All rates and treatments are **data-driven and effective-dated**, never hard-coded.

### 0.4 Design north star

Trust through transparency. Because money, tax, and the state are involved, every AI action is explainable, every figure is traceable to a source document, nothing is filed to the government without explicit human approval and a KEP signature, and every change is in an immutable audit log.

---

## 1. Product Architecture

### 1.1 Product layers

The product is conceived as five stacked layers, each with a clear responsibility boundary:

| Layer | Purpose | Examples of capability |
|-------|---------|------------------------|
| **Capture layer** | Get data in, in any form | Upload Center, email-to-inbox, client portal upload, bank import, e-invoice receipt |
| **Intelligence layer** | Turn raw data into structured, validated accounting facts | OCR & document intelligence, AI accounting suggestions, anomaly/duplicate detection |
| **Ledger layer** | The system of record | Double-entry engine, chart of accounts, fiscal years, journals, general ledger |
| **Compliance layer** | Transform records into what the state requires | VAT module, NAP integration, SAF-T engine, KEP signing |
| **Engagement layer** | How humans interact and collaborate | Dashboards, AI Accountant chat, client portal, notifications, reports |

A strict rule governs the layers: **the ledger layer is the single source of truth.** Intelligence proposes; humans (or configured auto-rules) approve; only approved facts enter the ledger; compliance reads from the ledger. The AI never writes directly to the books.

### 1.2 Product pillars

1. **Automate the boring 90%** — capture, classify, post, reconcile, report.
2. **Keep humans in command of the critical 10%** — approvals, edge cases, anything touching the state.
3. **Explain everything** — every suggestion shows its source, its confidence, and its reasoning.
4. **Compliance as a first-class feature**, not a bolt-on — VAT, SAF-T, NAP, KEP are core modules.
5. **Multi-tenant from line one** — firm-grade isolation, scaling, and bulk operations.

### 1.3 Conceptual domain model (entities, not tables)

Core aggregates the whole system revolves around:

- **Account / Tenant** — billing and ownership boundary. Owns subscription, users, organizations.
- **Organization** — optional grouping (a firm, or a holding). For a freelancer this is implicit.
- **Company** — a legal entity with EIK, VAT status, activity codes, fiscal calendar, chart of accounts, base currency.
- **Counterparty** — customers and suppliers (with EIK/VAT/country validation state).
- **Document** — any uploaded or generated artifact (invoice, bank statement, contract) with versions and lineage.
- **Extraction** — the structured data the intelligence layer derived from a Document, with confidence and validation results.
- **Sales Document** — invoice, credit note, debit note, proforma.
- **Journal Entry** — the atomic double-entry posting; the heart of the ledger.
- **VAT Period & VAT Return** — purchase/sales ledgers and the declaration derived from postings.
- **Bank Statement & Bank Transaction** — imported, matched, reconciled.
- **Reconciliation Match** — link between bank transactions and documents/entries.
- **Signature** — a KEP signing event over a document or submission.
- **Audit Event** — immutable record of who/what/when/why for every state change.
- **AI Suggestion / AI Feedback** — proposals and the human corrections that train future behaviour.

---

## 2. Business Architecture

### 2.1 Value proposition by segment

| Segment | Core pain | What the platform delivers |
|---------|-----------|----------------------------|
| Freelancer / self-employed | No accounting knowledge, fear of fines | Photograph a receipt → correct posting + VAT handled; plain-language guidance |
| Micro-enterprise | Bookkeeping eats owner's time | Automated capture, reconciliation, ready-to-file VAT |
| Small business | Growing volume, occasional accountant | Self-service books with accountant collaboration |
| Accountant (solo) | Manual data entry across many clients | One cockpit, bulk processing, AI does first pass |
| Accounting firm | Scaling headcount with client load | Multi-client management, role delegation, review workflows, audit trail for liability protection |

### 2.2 Revenue and packaging model (architectural implications)

The platform should support **subscription tiers + metered usage**, because both the entity count (firms) and the document volume (AI processing cost) drive cost:

- **Per-company subscription** (freelancer, micro, small) with monthly document allowances.
- **Firm plans** priced by managed-company count and seats, with pooled document volume.
- **Metered overages** for AI document processing beyond plan (OCR/LLM is a real marginal cost).
- **Add-ons**: NAP direct submission, SAF-T export, KEP signing volume, extra storage/retention.

Architecturally this requires a **usage-metering and entitlement service** that gates features per tenant and meters AI/storage consumption — designed in from the start even if billing is simple at MVP.

### 2.3 Business capabilities map

Capture → Validate → Classify → Post → Reconcile → Report → Comply → Advise. Each capability is owned by a module (Section 6) and exposes its state to the engagement layer. The firm-mode "review and approve" workflow is a cross-cutting capability layered over Classify/Post.

### 2.4 Partner ecosystem (future business architecture)

Banks (statement feeds / open banking PSD2), KEP providers (B-Trust, Evrotrust, StampIT and other Bulgarian QTSPs), the NRA portal, e-invoicing networks (Peppol when mandated), and accounting-firm referral channels. The integration layer (Section 5) is built to add these as adapters.

---

## 3. User Roles

Roles are split into **platform-scoped** and **company-scoped**, because a firm user may have different rights on different client companies.

### 3.1 Platform / tenant-scoped roles

| Role | Description |
|------|-------------|
| **Account Owner** | Owns the tenant, billing, can delete the account. Usually firm principal or business owner. |
| **Tenant Admin** | Manages users, organizations, company creation, global settings. |
| **Billing Manager** | Subscription, invoices, payment methods only. |

### 3.2 Company-scoped roles

| Role | Typical user | Core rights |
|------|--------------|-------------|
| **Senior Accountant / Approver** | Firm senior, business owner | Full ledger, approve postings, file to NAP, sign with KEP |
| **Accountant** | Firm staff | Create/edit documents and postings, prepare returns, cannot file without approval (configurable) |
| **Bookkeeper / Operator** | Junior, data entry | Upload, capture, basic posting via AI suggestions; no approvals |
| **Reviewer / Auditor** | Internal/external reviewer | Read-only across books + audit trail; can comment, cannot edit |
| **Client User (portal)** | The firm's end client | Upload documents, view reports/archives, receive notifications for *their* company only |
| **Read-only Viewer** | Stakeholder, investor | Reports and dashboards only |

### 3.3 AI as an actor

The AI is modeled as a **non-human actor** with its own identity in the audit trail. Its "permissions" are bounded: it may create *suggestions* and, where explicitly enabled per company, *auto-post* low-risk high-confidence entries — but it can never approve, sign, or submit to the state. Treating the AI as an auditable principal is essential for trust and liability.

### 3.4 Role assignment model

A user holds **one tenant-scoped role** and **per-company role assignments**. A firm accountant might be `Accountant` on 40 companies and `Senior Accountant` on 5. Client users are pinned to exactly one company. This many-to-many user↔company↔role mapping is the backbone of firm mode.

---

## 4. Permission Model

### 4.1 Model choice: RBAC with resource scoping (and ABAC where needed)

The base model is **Role-Based Access Control**, scoped by resource hierarchy (tenant → company → object). For sensitive actions, **attribute-based** conditions layer on top (e.g. "can file to NAP only if company KEP is configured and the user holds Approver on this company and MFA was satisfied this session").

### 4.2 Permission dimensions

Every permission check answers four questions:
1. **Who** — user identity and roles.
2. **Where** — which tenant/company scope.
3. **What** — the resource and action (view, create, edit, delete, approve, sign, submit, export).
4. **Under what conditions** — MFA freshness, period lock status, KEP availability, data-residency.

### 4.3 Representative permission matrix (company scope)

| Action | Bookkeeper | Accountant | Senior/Approver | Reviewer | Client User |
|--------|:---------:|:---------:|:---------:|:---------:|:---------:|
| Upload documents | ✔ | ✔ | ✔ | – | ✔ |
| View documents/reports | ✔ | ✔ | ✔ | ✔ | ✔ (own) |
| Accept/edit AI extraction | ✔ | ✔ | ✔ | – | – |
| Create/edit invoices | – | ✔ | ✔ | – | – |
| Post journal entries | suggest only | ✔ | ✔ | – | – |
| Approve postings | – | – | ✔ | – | – |
| Prepare VAT return | – | ✔ | ✔ | – | – |
| File to NAP / sign with KEP | – | – | ✔ | – | – |
| Lock/unlock period | – | – | ✔ | – | – |
| Manage users/roles | – | – | tenant admin | – | – |
| View audit trail | – | ✔ | ✔ | ✔ | – |

### 4.4 Hard guardrails (non-overridable)

- **Period locks**: once a VAT period is filed, its postings are locked; corrections go through a controlled correction workflow, never silent edits.
- **Segregation of duties**: the user who prepares a state submission can be required (per firm policy) to differ from the user who approves/signs it.
- **State submissions always require explicit human approval + KEP**, regardless of any AI automation settings.
- **Cross-tenant isolation is absolute** and enforced at the data layer (row-level security), not only the application layer.

---

## 5. System Architecture

### 5.1 Architectural style

A **modular monolith at MVP, decomposable into services** along the module seams later. This is deliberate: a startup serving micro-businesses should not pay the operational tax of microservices on day one, but the module boundaries (Section 6) are drawn so that the document-processing pipeline, the AI services, and the compliance/export engines can be extracted into independent services when volume demands.

### 5.2 Logical components

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTS:  Web app  ·  Mobile (capture-first)  ·  Client portal │
└───────────────┬──────────────────────────────────────────────┘
                │  (TLS, authenticated)
┌───────────────▼──────────────────────────────────────────────┐
│  EDGE:  API gateway · authn/authz · rate limiting · i18n      │
├───────────────────────────────────────────────────────────────┤
│  APPLICATION CORE (modular):                                   │
│   Company · Counterparties · Invoicing · Documents · Ledger    │
│   VAT · Bank Recon · Receivables/Payables · Reporting          │
│   Compliance (NAP · SAF-T · KEP) · Audit · Billing/Entitlement │
├───────────────────────────────────────────────────────────────┤
│  AI SERVICES (async):                                          │
│   Document Intelligence (OCR+extraction) · Accounting Engine    │
│   (suggestion/anomaly) · AI Accountant (RAG assistant)         │
├───────────────────────────────────────────────────────────────┤
│  PLATFORM SERVICES:                                            │
│   Job queue/workers · Notifications · Search · Vector store    │
│   Feature flags · Secrets/KMS                                  │
├───────────────────────────────────────────────────────────────┤
│  DATA:  Primary DB (Postgres, RLS) · Object storage (docs)     │
│         · Audit/event store (append-only) · Cache              │
├───────────────────────────────────────────────────────────────┤
│  INTEGRATIONS (adapters):                                      │
│   NRA/НАП · KEP/QTSP providers · Banks/PSD2 · VIES · Peppol     │
│   · Email · LLM/OCR vendors                                    │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 Multi-tenancy model

**Shared database, shared schema, row-level isolation** keyed on tenant and company, enforced by database row-level security as the last line of defence. Rationale: thousands of small tenants make schema-per-tenant operationally heavy; RLS gives strong isolation at low cost. Large-firm tenants with strict residency needs can later be promoted to a dedicated database without code change (the data-access layer is tenant-aware).

### 5.4 Document processing pipeline (asynchronous)

Capture → virus scan → store original immutably → classify document type → OCR → structured extraction → validation (format, EIK/VAT/IBAN checks, duplicate detection) → AI accounting suggestion → human review queue → approval → ledger posting. The pipeline is event-driven and **idempotent**: reprocessing a document never double-posts.

### 5.5 Data residency & hosting

Because of GDPR and the sensitivity of tax data, **all primary data and backups are hosted in the EU** (an EU region of a major cloud, or EU-based infrastructure). AI vendor calls are routed to **EU endpoints with no-training/zero-retention terms**, or to self-hosted models for the most sensitive content. Data residency is a configurable tenant attribute to support future country expansion.

### 5.6 Environments & deployment

Separate development, staging, and production environments; infrastructure-as-code; isolated secrets per environment; blue/green or rolling deploys; production data never copied to lower environments unmasked.

---

## 6. Module Architecture

Each module below lists its responsibility, key inputs/outputs, and notable rules. Modules communicate through well-defined internal contracts and emit audit events.

### 6.1 Company Management
Owns company profiles, EIK, VAT registration status and history, NACE/business-activity codes, fiscal calendar, base currency (EUR) with BGN legacy handling, chart-of-accounts selection, and multi-company membership. Effective-dated VAT registration is critical (a company's VAT status changes over time and drives treatment).

### 6.2 Clients & Suppliers (Counterparties)
Customer and supplier master data with **EIK validation**, **VAT number validation incl. VIES** for intra-EU partners, country validation, and de-duplication. Stores validation timestamp and result for audit. A counterparty can be both customer and supplier.

### 6.3 Sales & Invoicing
Creation of invoices, credit notes, debit notes, and proforma invoices with correct Bulgarian invoice requirements (sequential numbering, mandatory fields, VAT breakdown), **dual BGN/EUR display through 8 Aug 2026**, multi-language output, email delivery with delivery tracking, payment tracking, customer history, and a product/service catalogue. Designed so a future **e-invoice clearance adapter** can intercept issuance without UX change.

### 6.4 Document Management
Upload Center, storage, archive, search, filtering, and version history for PDF/JPG/JPEG/PNG/TIFF/XML/ZIP (ZIP auto-expanded; XML parsed natively). Originals are stored immutably; all derived/edited versions are tracked with lineage back to the source. Retention policy is configurable per legal requirement (Bulgarian record-keeping spans years; the system defaults to long-term retention).

### 6.5 OCR & Document Intelligence
Reads documents, extracts the full accounting field set (supplier, customer, VAT no., EIK, invoice no., date, net, VAT, total, currency, IBAN, description), validates extracted data, detects duplicates and missing fields, and assigns a **confidence score** per field. Low-confidence fields are flagged for human review; high-confidence complete documents may be fast-tracked. (Detailed AI design in Section 15.)

### 6.6 AI Accounting Engine
Suggests journal entries and account coding, suggests VAT treatment (rate, reverse charge, intra-EU, exempt), detects anomalies (unusual amounts, wrong-period dating, mismatched VAT), detects duplicate invoices, surfaces accounting risks, and **learns from user corrections** via a feedback loop scoped per company and per counterparty (it remembers how *this* business codes *this* supplier). Output is always a suggestion with reasoning and confidence.

### 6.7 VAT Module
Generates the **purchase ledger (дневник на покупките)**, **sales ledger (дневник на продажбите)**, the **VAT return (справка-декларация)**, and supporting reports (incl. VIES for intra-EU). Validates VAT numbers, detects missing VAT and duplicates. Monthly period model aligned to the **14th-of-next-month** filing deadline. All outputs are derived purely from approved ledger postings, never entered separately.

### 6.8 Accounting Engine (Ledger)
The double-entry core: journal entries, general ledger, trial balance, account movements, and financial reports, on the **Bulgarian national chart of accounts** (with NSS/IFRS basis selectable). Abstracts complexity so non-accountants interact through guided flows and AI suggestions while the engine maintains correct double-entry, period control, and the EUR/BGN redenomination boundary at 1 Jan 2026.

### 6.9 Bank Reconciliation
Imports **MT940, CAMT.053, CSV, XLSX** (and is ready for PSD2/open-banking feeds). Matches transactions to invoices and entries with automatic reconciliation for confident matches and a review queue for the rest. Handles partial payments, FX, and bank fees.

### 6.10 Receivables & Payables
Tracks outstanding invoices, due dates, overdue balances, and payment status; produces aging views and powers dunning/reminder notifications.

### 6.11 Client Portal
A restricted surface for the firm's end clients to upload documents, view reports and archives, and receive notifications — strictly scoped to their own company, with a simplified UX distinct from the accountant cockpit.

### 6.12 NAP Integration
Generates NAP-compliant files and prepares VAT and regulatory submissions; manages submission packaging, KEP signing handoff, and (future phase) direct electronic submission. (Strategy in Section 16.)

### 6.13 KEP (Qualified Electronic Signature)
KEP-based authentication, document and submission signing, secure approval, and a signature audit trail under eIDAS. (Strategy in Section 17.)

### 6.14 SAF-T Engine
Maps ledger and master data to the **versioned NRA SAF-T schema**, validates against published rules, and produces monthly/annual/on-request XML exports signed with KEP. Built now (data shaped correctly) even though target users aren't yet in scope. (Strategy folded into Sections 16 & 20–22.)

### 6.15 AI Accountant (Assistant)
A grounded conversational assistant answering VAT, accounting, and financial questions, explaining entries, obligations, results, and compliance issues — in the user's language, citing the company's own data and Bulgarian tax sources. Never invents figures; defers to the ledger. (Design in Section 15.)

### 6.16 Audit Trail Engine
Append-only recording of every uploaded document, modified record, AI recommendation, user correction, approval, and signature. Every action is traceable to actor, time, before/after state, and reason. (Architecture in Section 18.)

---

## 7. Navigation Architecture

### 7.1 Two navigation shells

- **Firm shell** (firm mode): top-level is the **client/company list**; a global search across companies; a firm-wide "work queue" (everything needing attention across all clients); then drill into a single company's workspace.
- **Company shell** (self-serve mode, or after drilling in): the company workspace with module navigation.

A persistent **company switcher** lets firm users jump between client companies without losing context.

### 7.2 Primary navigation (company workspace)

1. **Dashboard** (overview & to-dos)
2. **Documents** (Upload Center, archive, search)
3. **Sales** (invoices, credit/debit notes, proforma, catalogue)
4. **Purchases / Expenses**
5. **Banking** (import, reconciliation)
6. **Accounting** (journal, ledger, trial balance)
7. **VAT & Compliance** (ledgers, returns, NAP, SAF-T)
8. **Receivables & Payables**
9. **Reports**
10. **AI Accountant** (always-available assistant)
11. **Settings** (company, users, integrations, KEP)

### 7.3 Navigation principles

Capture is one tap from anywhere (a global "+ Add document/invoice"); the AI Accountant is globally accessible; the review/approval queue is a first-class destination, not buried; compliance deadlines are surfaced as navigation badges.

---

## 8. Sitemap

```
/ (marketing/login)
/auth (login, MFA, KEP login, password reset)
/onboarding (create company / import / connect bank / KEP setup)

[FIRM MODE]
/firm/dashboard ......... firm-wide KPIs, deadlines, work queue
/firm/clients ........... list of managed companies + status
/firm/work-queue ........ cross-company items needing attention
/firm/reports ........... aggregated firm reporting
/firm/team .............. users, roles, per-company assignments
/firm/billing

[COMPANY WORKSPACE]  (/c/{companyId}/…)
  /dashboard
  /documents
    /documents/upload
    /documents/archive
    /documents/{id} (detail, versions, extraction, lineage)
  /sales
    /sales/invoices, /credit-notes, /debit-notes, /proforma
    /sales/catalogue
    /sales/customers
  /purchases
    /purchases/expenses, /suppliers
  /banking
    /banking/import, /banking/reconciliation
  /accounting
    /accounting/journal, /ledger, /trial-balance, /chart-of-accounts
  /vat
    /vat/purchase-ledger, /sales-ledger, /returns, /vies
  /compliance
    /compliance/nap, /compliance/saf-t, /compliance/kep
  /receivables-payables
  /reports
  /ai-accountant
  /settings
    /settings/company, /users, /integrations, /kep, /language, /retention
  /audit-trail

[CLIENT PORTAL]  (/portal/{companyId}/…)
  /portal/dashboard
  /portal/upload
  /portal/reports
  /portal/archive
  /portal/notifications

[ADMIN]
/admin (tenant settings, subscription, data residency, entitlements)
```

---

## 9. User Flows

### 9.1 Flow — Document to posted entry (the core loop)

1. User (or client, or email-in) uploads a supplier invoice.
2. System scans, stores the original immutably, classifies it as a purchase invoice.
3. OCR + extraction populate fields with per-field confidence; EIK/VAT/IBAN validated; duplicate check runs.
4. AI Accounting Engine proposes the journal entry and VAT treatment with reasoning.
5. Item lands in the **review queue**; low-confidence fields highlighted.
6. User confirms or corrects (corrections feed the learning loop).
7. On approval, the entry posts to the ledger; audit event recorded; document marked reconciled-ready.
8. If auto-post is enabled and confidence is high, steps 5–7 happen automatically but remain fully audited and reversible.

### 9.2 Flow — Create and send a sales invoice

Select customer (validated) → add catalogue items → system computes VAT and **dual BGN/EUR totals** (until Aug 2026) → preview in chosen language → issue with sequential number → email with delivery tracking → posting created → receivable opened.

### 9.3 Flow — Bank reconciliation

Import statement (MT940/CAMT.053/CSV/XLSX) → transactions parsed → auto-match to invoices/entries → confident matches auto-reconciled → exceptions to review queue → user resolves partials/fees/FX → reconciliation closed for the period.

### 9.4 Flow — VAT period close & file

System assembles purchase/sales ledgers from approved postings → validation (missing VAT, duplicates, anomalies) → AI Accountant explains the result and flags risks → preparer reviews → approver approves → NAP-compliant files generated → **signed with KEP** → submitted (manually downloaded for portal upload at MVP; direct submission in a later phase) → period locked → confirmation archived.

### 9.5 Flow — Firm onboarding a new client company

Firm admin creates company → enters EIK (auto-fetch/validate) → sets VAT status, fiscal calendar, chart of accounts → assigns staff roles → connects bank and KEP → invites client to portal → imports historical data (incl. BGN-era records with redenomination boundary).

### 9.6 Flow — Asking the AI Accountant

User asks (in BG or EN) "Can I deduct VAT on this restaurant bill?" → assistant retrieves relevant Bulgarian VAT rules + the specific document/company context → answers in the user's language with citations and a clear "this is guidance, the posting decision is yours" framing → optionally drafts the suggested treatment for review.

### 9.7 Flow — KEP signing

User initiates a signature on a submission/document → KEP flow invoked (browser/cloud-QTSP/token) → user authenticates with their qualified certificate → signature applied → signature event + certificate metadata recorded in the audit trail.

---

## 10. Dashboard Architecture

### 10.1 Three dashboard types

| Dashboard | Audience | Answers the question |
|-----------|----------|----------------------|
| **Firm dashboard** | Accountant/firm | "Across all my clients, what needs attention and what's at risk?" |
| **Company dashboard** | Owner/accountant | "How is this business doing and what do I owe / need to do?" |
| **Client portal dashboard** | End client | "Is everything handled, what do I need to send, what can I see?" |

### 10.2 Firm dashboard contents
Cross-company work queue (documents awaiting review, returns due, unreconciled items), a **compliance deadline calendar** (VAT 14th, SAF-T cadence, annual filings), client health indicators (overdue tasks, missing documents), AI-flagged risks aggregated across clients, and team workload distribution.

### 10.3 Company dashboard contents
Cash position, receivables/payables aging, current VAT position for the open period, recent documents and their processing status, anomalies/risks flagged by AI, upcoming deadlines, and a "what needs your approval" panel. All monetary values in EUR with BGN reference where relevant during the dual-display window.

### 10.4 Dashboard principles
Action-oriented (every card links to the place to act), deadline-aware (compliance dates are prominent), trust-building (figures link to source documents), and role-filtered (a bookkeeper sees tasks, an owner sees money).

---

## 11. UX Architecture

### 11.1 Experience principles
- **Capture-first**: the fastest path from "I have a receipt" to "it's handled" defines the product. Mobile capture and email-in are primary, not afterthoughts.
- **Progressive disclosure**: non-accountants see plain language and guided actions; accountants can expand into full ledger detail. The same object (a posting) has a "simple" and an "expert" view.
- **Review, don't re-enter**: humans confirm AI work; typing is the exception.
- **Explainability everywhere**: confidence indicators, "why this suggestion", and source-document links are built into components, not hidden.
- **Calm, banking-grade trust**: restrained, precise, no clutter — the user is handling money and the state.

### 11.2 Key interaction patterns
- **Review queue** as a focused, keyboard-friendly triage surface (approve/correct/reject quickly).
- **Side-by-side document view**: original document next to extracted/structured data for fast verification.
- **Inline AI**: the AI Accountant can be invoked in-context (on an invoice, a return, a transaction) not only as a separate chat.
- **Bulk actions** for firm mode (approve many, post many, request many documents).
- **Deadline nudges** rather than nagging — proactive, dismissible, escalating only near due dates.

### 11.3 Accessibility & device strategy
WCAG 2.1 AA target; responsive web for full workflows; a focused mobile experience optimised for capture, approvals, and dashboards (not full ledger editing). Offline-tolerant capture (queue uploads when connectivity is poor).

### 11.4 Onboarding UX
Guided first-run: create/import company, validate EIK, set VAT status, connect a bank, set up KEP, and process the first document end-to-end to deliver an immediate "it works" moment.

---

## 12. Design System Architecture

### 12.1 Foundations
A token-based design system (colors, typography, spacing, radii, elevation, motion as named tokens) so theming, white-label firm branding, and dark mode are configuration, not rework.

### 12.2 Visual language
- **Palette**: white base, light blue (primary/trust), green (positive/confirmation/success). Restrained accent use; ample whitespace; banking-grade precision. Red/amber reserved strictly for risk, errors, and deadlines.
- **Typography**: a clean, highly legible sans-serif with strong **Cyrillic and Latin** coverage (Bulgarian is primary — Cyrillic glyph quality is a hard requirement, including Bulgarian-specific letterforms). Tabular figures for all financial numbers.
- **Tone**: professional, minimal, credible.

### 12.3 Component layers
1. **Primitives** — buttons, inputs, selects, badges, tooltips.
2. **Financial components** — money field (currency-aware, dual-display capable), VAT-rate selector, account picker, date/period picker, confidence badge, document viewer.
3. **Domain components** — review-queue row, journal-entry editor, reconciliation matcher, invoice builder, deadline card.
4. **Layouts** — firm shell, company workspace, portal, dashboard grids.

### 12.4 Localization-aware components
Every component is built for variable text length (Bulgarian strings differ in length from English), locale number/date/currency formatting, and Cyrillic rendering from day one. No hard-coded strings, ever.

### 12.5 Governance
A single source of truth for tokens and components, versioned, with documentation; design and engineering share the same definitions to prevent drift.

---

## 13. Multi-language Architecture

### 13.1 Scope of localization
Full UI localization, AI responses, invoices, reports, notifications, and emails — all in the selected language. **Bulgarian is default**, English secondary, architecture ready for additional countries (not just languages — countries bring their own tax rules).

### 13.2 Separation of concerns: language vs. jurisdiction
A crucial distinction: **language ≠ jurisdiction**. The platform separates:
- **Locale** (language + formatting): drives UI text, number/date/currency display, document language.
- **Jurisdiction pack** (tax/compliance rules): chart of accounts, VAT rules, ledger/return formats, SAF-T schema, e-filing integration.

This separation is what makes country expansion feasible: adding a new country means adding a **jurisdiction pack + locale**, not rewriting the core. Bulgaria ships as the first jurisdiction pack.

### 13.3 Translation architecture
Externalized translation resources keyed by namespace; no strings in code; interpolation and pluralization support; fallback chain (selected language → Bulgarian → English). A translation-management workflow keeps BG/EN in sync and supports adding languages without releases.

### 13.4 AI and language
The AI Accountant detects and responds in the user's selected language; document extraction handles Bulgarian and English source documents; generated documents (invoices/reports) render in the chosen language while preserving legally required Bulgarian elements where mandated.

### 13.5 Document & data language
Master data (counterparty names, descriptions) may be in either script; the system stores original text faithfully (full Unicode/Cyrillic) and never transliterates silently.

---

## 14. Security Architecture

### 14.1 Compliance posture
Designed to GDPR, OWASP Top 10, and **ISO 27001-ready** from the outset (the architecture supports certification; certification itself is an organizational milestone). The platform is treated throughout as a custodian of sensitive financial and personal tax data.

### 14.2 Identity & access
- **MFA** mandatory for all staff/accountant roles; available for all users.
- **KEP-based authentication** as a strong-auth option (eIDAS qualified).
- **RBAC + resource scoping + ABAC** conditions (Section 4).
- Session management with short-lived tokens, refresh rotation, device/session visibility and revocation.
- SSO option for firms (future).

### 14.3 Data protection
- **Encryption in transit** (TLS everywhere) and **at rest** (database, object storage, backups).
- **Key management** via a managed KMS; envelope encryption; documented key rotation.
- Field-level encryption for the most sensitive identifiers where warranted.
- **Tenant isolation** enforced at the data layer (row-level security) beneath application checks.

### 14.4 Application security
Secure SDLC, dependency scanning, SAST/DAST, input validation and output encoding, protection against the OWASP Top 10 (injection, broken access control, SSRF, etc.), rate limiting, and abuse protection on upload and AI endpoints. Uploaded files are virus/malware-scanned and sandboxed during parsing (untrusted PDFs/XML/ZIP are an attack surface — ZIP bombs, XML external entities, malicious macros are explicitly mitigated).

### 14.5 Privacy / GDPR specifics
EU data residency; lawful-basis and purpose tracking; **data subject rights** (access, rectification, erasure where legally permissible — noting that statutory accounting-retention obligations can override erasure); data processing agreements with sub-processors (LLM/OCR vendors) on zero-retention/no-training terms; data minimization; configurable retention aligned to Bulgarian record-keeping law.

### 14.6 Backup & disaster recovery
Automated, encrypted, geographically redundant backups within the EU; regular restore testing; defined **RPO/RTO** targets; documented incident-response and breach-notification procedures (GDPR 72-hour notification readiness).

### 14.7 Auditability
The audit trail (Section 18) is itself a security control: tamper-evident, append-only, covering authentication, authorization decisions for sensitive actions, data access to sensitive records, and all state submissions/signatures.

---

## 15. AI Architecture

### 15.1 Three AI subsystems with clear boundaries

| Subsystem | Job | Output | Authority |
|-----------|-----|--------|-----------|
| **Document Intelligence** | Read & extract from documents | Structured fields + confidence | Proposes data |
| **Accounting Engine** | Suggest coding, VAT, detect risk | Suggested entries + reasoning | Proposes postings |
| **AI Accountant** | Answer & explain | Grounded answers + citations | Advises only |

None of them can approve, sign, or submit. The AI is an auditable actor (Section 3.3).

### 15.2 Document Intelligence pipeline
A layered approach rather than a single black box: document classification → OCR (print + reasonable handwriting) → **layout-aware structured extraction** (combining OCR output with a vision-capable model for robust field extraction across varied invoice layouts) → deterministic validation (regex/format checks, EIK checksum, VAT/VIES validation, IBAN validation, arithmetic checks that net + VAT = total) → duplicate detection (content fingerprinting + fuzzy match on supplier/number/amount/date) → per-field confidence scoring. Deterministic validators are trusted over the model for anything checkable.

### 15.3 Accounting suggestion & learning loop
The engine proposes account coding and VAT treatment using: company-specific history (how this company codes this supplier), Bulgarian chart-of-accounts and VAT rules, and learned patterns from accepted/corrected suggestions. **Human corrections are the training signal** — captured as structured feedback, scoped per company/counterparty, improving future suggestions without leaking one tenant's data into another's. Anomaly detection flags outliers (amount, period, VAT mismatch, unusual counterparty).

### 15.4 AI Accountant — grounded assistant (RAG)
Built on **retrieval-augmented generation**: the assistant retrieves from (a) a curated, versioned corpus of Bulgarian tax/accounting rules and (b) the specific company's own ledger/document context, then answers with citations in the user's language. Guardrails: it never fabricates figures (numbers come from the ledger, not the model), it labels guidance vs. fact, it defers final decisions to the human, and it refuses to "file" or "approve" anything.

### 15.5 Model strategy
Vendor-flexible via an **LLM/OCR abstraction layer** so models can be swapped or mixed (frontier API models for reasoning/extraction; specialized OCR; self-hosted models for the most sensitive data or cost control). All external AI calls use EU endpoints with zero-retention/no-training contractual terms. Costs are metered per tenant (ties to billing, Section 2.2).

### 15.6 Trust, evaluation & safety
- **Confidence-gated automation**: only high-confidence, low-risk items are eligible for auto-posting (and only where the company opted in); everything else goes to human review.
- **Continuous evaluation**: extraction accuracy, suggestion acceptance rate, and hallucination checks are measured against a labeled dataset; regressions block model changes.
- **Full traceability**: every AI suggestion and its inputs are logged so any posting can be explained after the fact.
- **Human-in-the-loop is non-negotiable** for anything touching money movement or the state.

---

## 16. NAP Integration Strategy

### 16.1 Phased approach
1. **Phase A (MVP) — Compliant file generation + assisted manual submission.** Generate validated, NAP-compliant VAT files (purchase ledger, sales ledger, declaration; VIES where relevant), let the user sign with KEP, and guide them to submit via the NRA portal (download + upload). This delivers value without depending on direct-submission access.
2. **Phase B — SAF-T export.** Produce versioned SAF-T XML (monthly/annual/on-request), validated against the published NRA schema and signed with KEP. Built data-ready from MVP even though target users aren't yet in scope.
3. **Phase C — Direct electronic submission.** Integrate with NRA electronic submission channels for end-to-end filing, with confirmations stored in the audit trail.
4. **Phase D — E-invoicing / real-time reporting.** When Bulgaria mandates B2B e-invoicing/clearance (expected toward 2028–2030, likely UBL 2.1 / Peppol), activate the pre-built clearance adapter.

### 16.2 Architectural principles
- **Schema as configuration**: NRA/SAF-T formats are externalized and versioned; format changes are data updates, not code releases. (The NRA reissued/amended SAF-T technical docs through 2025–2026 — volatility is expected.)
- **Validation before submission**: every file passes deterministic validation against the official rules and arithmetic/consistency checks before a human is asked to approve.
- **Always KEP-signed, always human-approved** before anything reaches the state.
- **Submission ledger**: every generated file, signature, submission attempt, and confirmation is recorded immutably.
- **Adapter pattern**: NRA, Peppol, and future channels are pluggable integration adapters behind a stable internal contract.

---

## 17. KEP (Qualified Electronic Signature) Integration Strategy

### 17.1 Role of KEP
KEP (qualified electronic signature under eIDAS) is used for **authentication** (strong login), **signing** state submissions and key documents, and **secure approval** of sensitive actions — producing legally meaningful, non-repudiable signatures.

### 17.2 Provider abstraction
Bulgarian QTSPs (e.g. B-Trust, Evrotrust, StampIT and others) and signing modalities (smart-card/USB token via local middleware, cloud/remote QES, mobile signing) are integrated behind a **single signing abstraction**. The product UX is provider-agnostic; adding a provider is an adapter.

### 17.3 Signing flow & security
The platform prepares the document/submission, hands off to the KEP flow for authentication and signature, receives the signed artifact and certificate metadata, verifies the signature, and records the event. The platform **never holds users' private keys**; signing happens in the certificate holder's secure environment or the QTSP's cloud HSM.

### 17.4 Signature audit trail
Each signature records: signer identity, certificate details and validity, timestamp (qualified timestamp where applicable), the exact artifact signed (hash), and the action context. Signatures are immutable and independently verifiable.

### 17.5 Segregation & policy
Firms can require that the approver/signer differs from the preparer; KEP availability is a precondition (ABAC) for state-submission actions.

---

## 18. Audit Trail Architecture

### 18.1 Principles
**Append-only, immutable, comprehensive, and tamper-evident.** Nothing in the audit log can be edited or deleted; corrections are new events. The log is a primary feature (liability protection for firms, regulatory defensibility) not a debugging afterthought.

### 18.2 What is captured
Every: document upload, record create/modify/delete, **AI recommendation and its inputs**, **user correction of AI**, approval, period lock/unlock, KEP signature, state submission and confirmation, permission change, and access to sensitive data. Each event records **who (human or AI actor), what, when, before/after state, and why/context**.

### 18.3 Integrity
Events are written to an append-only store with **hash-chaining** (each event references the prior event's hash) so any tampering is detectable. Audit data is retained per legal requirement and is itself access-controlled (viewable by Reviewer/Auditor/Approver roles).

### 18.4 Usability
The audit trail is queryable and filterable (by object, actor, action, period) and presented as a human-readable history on each record ("what happened to this invoice") — not just a raw log.

---

## 19. Scalability Strategy

### 19.1 Scaling dimensions
Three distinct axes scale differently: **tenants/companies** (many small entities), **document/transaction volume** (the AI-cost driver), and **firm concurrency** (bulk operations across many companies). The architecture addresses each.

### 19.2 Approach
- **Stateless application tier** behind a load balancer; scale horizontally.
- **Asynchronous, queue-based document pipeline**: capture returns immediately; OCR/extraction/AI run on autoscaling workers; spikes (month-end, VAT deadline) are absorbed by the queue. Idempotent processing prevents double-posting on retries.
- **Database**: read replicas for reporting/dashboards; partitioning by tenant/period as data grows; RLS-based shared schema for the long tail, with the option to promote large firms to dedicated databases without code change.
- **Object storage** for documents scales independently and cheaply; hot/cold tiering for archives.
- **Caching** for reference data (chart of accounts, VAT rules, exchange rate) and dashboards.
- **Search and vector stores** scale separately from the transactional core.
- **AI cost control**: confidence gating, caching of extraction results, batching, model tiering (cheap model first, escalate only when needed), and per-tenant metering.

### 19.3 Decomposition path
The modular monolith is split along its seams when needed — document intelligence, AI services, and compliance/export engines are the first candidates to become independent services, since they have distinct scaling and cost profiles.

### 19.4 Reliability
Defined RPO/RTO, multi-AZ within the EU region, graceful degradation (if an AI vendor is down, capture and manual workflows still function; AI suggestions queue), and circuit breakers around external integrations (NRA, banks, QTSPs).

---

## 20. MVP Scope

**Goal:** a freelancer or micro-business (and a small firm managing a handful of them) can capture documents, get AI-assisted correct postings and VAT, reconcile the bank, and produce a KEP-signed, NAP-compliant VAT return — in Bulgarian, in euro.

### 20.1 In scope (MVP)
- Account/tenant, company management (EIK + VAT status), basic firm mode (manage multiple companies, per-company roles).
- Counterparties with EIK + VAT/VIES validation.
- Document Management + Upload Center (PDF/JPG/PNG/TIFF/XML/ZIP) with immutable originals and versioning.
- **Document Intelligence**: OCR + extraction of the full field set, validation, duplicate/missing-field detection, confidence scoring.
- **AI Accounting Engine v1**: entry + VAT-treatment suggestions with reasoning and the human-correction learning loop; review queue.
- Ledger core: Bulgarian chart of accounts, journal, general ledger, trial balance, with **EUR base currency and BGN legacy/redenomination handling + dual display through Aug 2026**.
- Sales & invoicing (invoices, credit/debit notes, proforma) with dual-currency display, multi-language output, email delivery, payment tracking, catalogue.
- VAT module: purchase/sales ledgers, VAT return, VIES, validation.
- Bank reconciliation: MT940, CAMT.053, CSV, XLSX with auto-matching and review.
- Receivables & payables (aging, status).
- **NAP Phase A**: compliant file generation + KEP signing + assisted manual submission.
- **KEP** authentication + signing (at least one QTSP + cloud signing) with signature audit trail.
- **AI Accountant v1**: grounded Q&A in BG/EN with citations.
- Dashboards (firm + company), notifications.
- **Audit trail** (append-only) across all of the above — required at MVP, not deferred.
- Full **BG + EN localization**; design system; security baseline (MFA, RBAC, encryption, EU hosting, backups).
- **SAF-T-shaped data model** (no export UI yet, but data is structured so it's ready).

### 20.2 Explicitly out of MVP
Direct NAP submission, SAF-T export UI, e-invoicing clearance, client portal, advanced anomaly/risk analytics, open-banking feeds, white-label branding, additional countries.

---

## 21. Phase 2 Scope

- **Client Portal** (clients upload, view reports/archives, notifications).
- **SAF-T Engine export** (monthly/annual/on-request XML, validated, KEP-signed) — activate as obligations widen toward smaller entities.
- **NAP Phase C — direct electronic submission** with stored confirmations.
- **Open banking / PSD2** automatic bank feeds (reduce manual import).
- **Advanced AI**: stronger anomaly/risk detection, smarter auto-posting with confidence gating, expense categorization improvements, cash-flow forecasting.
- **Firm-grade tooling**: bulk operations, work-queue automation, SSO, segregation-of-duties policies, white-label branding.
- **Richer reporting**: management reports, custom report builder, period comparisons across the euro changeover.
- Enhanced mobile capture experience.

---

## 22. Phase 3 Scope

- **E-invoicing / real-time reporting** clearance adapter activated when Bulgaria mandates B2B e-invoicing (UBL 2.1 / Peppol), with near-real-time NRA validation.
- **Country expansion**: second jurisdiction pack + locale, proving the language/jurisdiction separation (e.g. a neighbouring EU market).
- **Deeper AI autonomy** within strict guardrails: higher auto-posting coverage, proactive compliance assistant, predictive tax planning.
- **Marketplace/ecosystem**: bank, QTSP, and tool integrations; firm referral program; API for partners.
- **ISO 27001 certification** completion; advanced data-governance and DLP.
- Payroll and/or other adjacent modules (only if validated demand — staying true to "not an ERP").

---

## 23. Risks & Challenges

### 23.1 Regulatory & compliance risk
- **Moving targets**: SAF-T schema and e-invoicing rules are actively evolving (the NRA amended SAF-T docs in 2025–2026). *Mitigation*: schema-as-configuration, versioned formats, adapter pattern.
- **Euro transition edge cases**: redenomination boundary, dual display through Aug 2026, BGN-era historical data, rounding at the 1.95583 rate. *Mitigation*: explicit currency-boundary modeling, fixed-rate conversion utilities, dual-display as configuration.
- **Filing liability**: an incorrect submission has legal consequences. *Mitigation*: deterministic validation, mandatory human approval + KEP, immutable audit trail.

### 23.2 AI risk
- **Hallucination / wrong coding**: incorrect suggestions erode trust or cause errors. *Mitigation*: deterministic validators over the model, confidence gating, human-in-the-loop, RAG grounding with citations, continuous evaluation.
- **AI cost**: OCR/LLM is a real per-document marginal cost that can erode margins on low-priced plans. *Mitigation*: model tiering, caching, batching, metering tied to billing.
- **OCR accuracy on poor-quality Bulgarian documents**: varied layouts, handwriting, photos. *Mitigation*: layout-aware extraction + vision models, validation, graceful human fallback.

### 23.3 Security & privacy risk
- **Sensitive data custodianship**: financial + personal data is a high-value target. *Mitigation*: encryption, EU residency, RLS isolation, MFA/KEP, OWASP hardening, sub-processor DPAs with zero-retention.
- **Malicious uploads**: XML XXE, ZIP bombs, macro malware. *Mitigation*: sandboxed parsing, scanning, strict format handling.

### 23.4 Integration risk
- **KEP fragmentation**: multiple QTSPs and signing modalities, some requiring local middleware. *Mitigation*: signing abstraction + favour cloud/remote QES.
- **NRA/bank channel instability or access barriers**. *Mitigation*: phased integration (manual-assisted first), circuit breakers, graceful degradation.

### 23.5 Product & market risk
- **Trust barrier**: users must trust software with money and the state. *Mitigation*: transparency, explainability, human control, banking-grade UX.
- **Two-persona complexity**: serving both self-serve and firm modes well. *Mitigation*: shared core + two shells, validated early with both segments.
- **Scope creep toward ERP**. *Mitigation*: disciplined "automate accounting, not run the business" focus.
- **Accountant disintermediation fear**: positioning the AI as the accountant's tool, not their replacement, is both a go-to-market and a product-design choice.

### 23.6 Operational risk
- **Month-end / VAT-deadline load spikes**. *Mitigation*: queue-based async pipeline, autoscaling workers.
- **Data migration** of clients' historical books (incl. BGN era). *Mitigation*: dedicated import tooling with validation and the redenomination boundary.

---

## 24. Recommended Technology Stack

Vendor-neutral recommendations with rationale; final choices should weigh team expertise and the EU-residency / GDPR constraints above.

### 24.1 Frontend
- **Web**: TypeScript + a modern React framework (e.g. Next.js) for the app shells, with a component library built on the design-system tokens; Tailwind or an equivalent utility/token system; a robust i18n library (BG/EN, Cyrillic-ready).
- **Mobile (capture-first)**: a cross-platform approach (React Native or a PWA) prioritising document capture, approvals, and dashboards.

### 24.2 Backend
- A **modular monolith** in a strongly-typed, productive ecosystem — e.g. **TypeScript/Node (NestJS)** or **Python (FastAPI/Django)**. Python is attractive for proximity to the AI/document tooling; Node for a unified TypeScript stack. Either is defensible — choose for team strength.
- Clear module boundaries (Section 6) to allow later service extraction.

### 24.3 Data & storage
- **PostgreSQL** as the primary store, using **row-level security** for tenant isolation (Supabase or a managed EU Postgres are good fits); read replicas and partitioning as scale demands.
- **pgvector** (or a dedicated vector DB) for RAG embeddings.
- **S3-compatible EU object storage** for documents, with immutability/retention features.
- An **append-only audit/event store** (a dedicated table with hash-chaining, or an event-store technology) for the audit trail.
- A **cache** (Redis) for reference data and sessions.
- A **search engine** (e.g. OpenSearch/Elasticsearch or Postgres full-text at first) for document search.

### 24.4 Async & messaging
- A **job queue / message broker** (e.g. Redis-based queues, RabbitMQ, or a managed equivalent) driving the document pipeline and notifications, with autoscaling workers.

### 24.5 AI / document intelligence
- **OCR / document AI**: a managed document-intelligence service (e.g. Azure Document Intelligence, Google Document AI, AWS Textract — chosen for EU-region availability) and/or open-source (Tesseract + a layout model) for cost control.
- **LLMs**: frontier API models (via an abstraction layer) for extraction reasoning and the AI Accountant, on **EU endpoints with zero-retention/no-training terms**; self-hosted open models as a sensitive-data/cost option.
- **RAG**: curated, versioned Bulgarian tax/accounting corpus + company context via the vector store.

### 24.6 Integrations
- **KEP/QES**: integration with Bulgarian QTSPs (B-Trust, Evrotrust, StampIT, etc.) behind a signing abstraction; prefer cloud/remote QES.
- **NRA/НАП**: file generation + (later) electronic submission adapters; **SAF-T** XML with versioned schemas.
- **Banks**: file import (MT940/CAMT.053/CSV/XLSX) now; **PSD2/open banking** feeds later.
- **VIES** for EU VAT validation; **Peppol** for future e-invoicing.
- **Email** (transactional + capture inbox) via an EU-compliant provider.

### 24.7 Platform / DevOps & security
- **Cloud in an EU region** (or EU sovereign cloud) for residency; **infrastructure-as-code**; containerized workloads with managed orchestration.
- **CI/CD** with SAST/DAST and dependency scanning; secrets via a managed vault; **KMS** for encryption keys.
- **Observability**: logging, metrics, tracing, alerting; uptime and AI-quality dashboards.
- **Feature flags** for staged rollout and per-tenant entitlements.
- Encrypted, EU-redundant **backups** with tested restores; documented **DR** and incident response.

### 24.8 Summary table

| Concern | Recommendation | Why |
|---------|----------------|-----|
| Frontend | TypeScript + React/Next.js, token-based design system, i18n | Productivity, localization, Cyrillic support |
| Backend | Modular monolith (Node/NestJS or Python/FastAPI) | Speed now, decomposable later |
| Primary DB | PostgreSQL + RLS (+ pgvector) | Strong tenant isolation, EU-hostable, RAG-ready |
| Documents | EU S3-compatible object storage, immutable | Cheap, scalable, compliant |
| Audit | Append-only + hash-chaining | Tamper-evidence, liability defence |
| Async | Queue + autoscaling workers | Absorb deadline spikes, idempotent pipeline |
| OCR/AI | Managed doc-AI + frontier LLM (EU, zero-retention) + RAG | Accuracy + privacy + grounding |
| Signing | QTSP abstraction, cloud QES | Provider fragmentation, no key custody |
| Hosting | EU region, IaC, KMS, observability | GDPR residency, operability |

---

## Appendix A — Glossary (Bulgarian context)

| Term | Meaning |
|------|---------|
| **НАП / NAP / NRA** | Национална агенция за приходите — National Revenue Agency |
| **ЕИК / EIK** | Единен идентификационен код — Unified Identification Code (company ID) |
| **КЕП / KEP** | Квалифициран електронен подпис — Qualified Electronic Signature (eIDAS QES) |
| **ЗДДС / VAT Act** | Bulgarian VAT Act |
| **Справка-декларация** | The periodic VAT return/declaration |
| **Дневник на покупките / продажбите** | Purchase ledger / Sales ledger (VAT) |
| **VIES** | EU VAT Information Exchange System (cross-border VAT validation) |
| **SAF-T** | Standard Audit File for Tax (OECD standard; phased in BG from 2026) |
| **НСС / NSS** | National Accounting Standards (Bulgaria); IFRS as alternative basis |
| **QTSP** | Qualified Trust Service Provider (issuer of KEP) |
| **PSD2** | EU payment-services directive enabling open-banking feeds |
| **ViDA** | "VAT in the Digital Age" — EU initiative driving e-invoicing/reporting |
| **Fixed conversion rate** | EUR 1 = BGN 1.95583 (euro adoption 1 Jan 2026) |

---

## Appendix B — Key dated facts shaping this architecture (as of mid-2026)

- Euro adopted **1 Jan 2026**; fixed rate **1.95583**; dual price display mandatory **until 8 Aug 2026**; free lev exchange at banks until ~30 Jun 2026.
- SAF-T mandatory from **Jan 2026 for large enterprises only**, widening through ~2028 to medium/small and ~2030 to (nearly) all; monthly accounting+invoices by the **14th**, annual fixed assets by **30 Jun**, inventory on demand; KEP-signed. NRA technical documentation reissued/amended across 2025–2026 — treat schema as versioned.
- B2B e-invoicing **voluntary** in 2026 (post-audit model); B2G mandatory; clearance/real-time model under NRA consultation, expected toward 2028–2030 (likely UBL 2.1 / Peppol).
- Standard VAT 20%, reduced 9% — all rates data-driven and effective-dated.

> These are time-sensitive regulatory facts. Confirm current NRA guidance before each compliance build, as schemas and deadlines continue to evolve.

---

*End of v1.0 baseline architecture.*
