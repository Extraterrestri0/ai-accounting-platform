# AI Accounting Platform — Complete Backend Architecture

**Document type:** Backend architecture (conceptual — no code, no DDL)
**Builds on:** Master Architecture, UX, Design System, Screen Specs, Domain Model & Data Architecture, Rules Engine, AI Architecture (all v1.0)
**Acting as:** Principal Backend Architect · Senior SaaS Architect · Senior Fintech Architect · Senior Security Architect
**Status:** v1.0 — backend baseline

---

## Non-negotiable requirements (carried through every section)

- **PostgreSQL** as the system of record; **Row-Level Security (RLS)** as the last line of tenant isolation.
- **Event-driven** where appropriate, via a **transactional outbox**.
- **Queue workers** for OCR, AI, reports, SAF-T, and submissions (anything slow, spiky, or externally dependent).
- **Append-only audit log** (hash-chained) and **immutable ledger postings** (corrections by reversal only).
- **EU-based infrastructure** for all data, processing, and backups.
- **MVP = modular monolith, decomposable later** along bounded-context seams.
- **AI may never directly mutate** the ledger, NAP submissions, KEP signatures, or permissions — it proposes; humans/deterministic services commit.
- **Every action is tenant-scoped; every sensitive action is audited.**

---

## 1. Backend Architecture Overview

### 1.1 Shape of the system
A **modular monolith** application (one deployable, internally partitioned into bounded-context modules) fronted by an API/BFF layer, backed by **PostgreSQL with RLS**, emitting **domain events via an outbox**, and offloading slow/external/spiky work to **queue workers**. Files live in **EU S3-compatible object storage**. Reads for dashboards/reports come from **projections/read models** (CQRS-lite). The whole thing is stateless at the app tier (horizontally scalable) with state in Postgres, the queue, the cache, and object storage.

```
   Web / Mobile / Client Portal
            │  (TLS)
   ┌────────▼─────────────────────────────────────────────────┐
   │  EDGE: API gateway · authn · tenant-context · rate-limit  │
   ├───────────────────────────────────────────────────────────┤
   │  MODULAR MONOLITH (one deploy, many modules = contexts)    │
   │  Identity·Tenancy·MasterData·DocIntel·Invoicing·Ledger·    │
   │  Tax·Compliance·Banking·Reporting·Audit·Notification       │
   │  (in-process calls + domain events; clean seams)           │
   ├───────────────────────────────────────────────────────────┤
   │  Outbox dispatcher ──▶ event bus ──▶ subscribers/workers   │
   └───────┬───────────────────┬───────────────────┬───────────┘
           ▼                   ▼                   ▼
   PostgreSQL (RLS,       Queue (workers:      Object storage
   primary + replicas,    OCR·AI·reports·      (EU, encrypted,
   partitioned)           SAF-T·submissions)   immutable originals)
           │                   │
        Cache (Redis)     External (EU) via ACLs: NRA/НАП · KEP/QTSP ·
                          banks/PSD2 · VIES · LLM/OCR vendors · email
```

### 1.2 Core tactics
- **Write path:** synchronous, transactional, invariant-enforcing (double-entry, period locks, RLS). Emits events in the same transaction (outbox).
- **Read path:** projections/read models + replicas, never live-aggregating the ledger.
- **Async path:** queue workers for OCR/AI/reports/SAF-T/submissions; idempotent; never block capture.
- **Isolation:** `tenant_id` carried everywhere; RLS enforces it beneath the app.
- **Authority:** privileged mutations (ledger post, NAP file, KEP sign, permission change) live behind explicit, audited, role-gated services that **AI workers cannot call**.

---

## 2. Technology Stack Selection

The platform needs: financial correctness, strong domain modeling (DDD bounded contexts), event-driven async, deep AI/OCR integration, PostgreSQL+RLS, a decomposable modular monolith, EU hosting, and long-term maintainability with available talent.

### 2.1 Comparison

| Dimension | **Laravel (PHP)** | **NestJS (TS)** | **Django/FastAPI (Py)** | **.NET (C#)** |
|-----------|-------------------|-----------------|--------------------------|----------------|
| Type safety (fintech correctness) | Weak (dynamic; PHP8 typed-ish) | **Strong (TS)** | Medium (hints + Pydantic) | **Strong (C#)** |
| Modular-monolith / DDD fit | OK (packages) | **Excellent (modules+DI)** | OK (Django apps / FastAPI routers) | **Excellent (projects/DI)** |
| Decomposition to services | OK | **Excellent (built-in transports)** | OK | **Excellent** |
| PostgreSQL + RLS | Good | **Good** | **Good** | Good |
| Queue/worker ecosystem | Horizon (good) | **BullMQ (excellent)** | Celery (excellent) | Hangfire/MassTransit (excellent) |
| AI/OCR ecosystem (in-process) | Weak | Medium | **Excellent (native)** | Medium |
| Frontend alignment (React/Next.js TS) | None | **Same language end-to-end** | None | None |
| Performance | Good | Good | Good (FastAPI) | **Excellent** |
| Talent availability (BG/EU startup) | **High** | **High** | High | Medium |
| Speed to MVP | **High** | High | High | Medium |
| Ecosystem maturity for SaaS | High | High | High | **High** |

### 2.2 Recommendation: **NestJS (TypeScript) primary app + Python workers for AI/OCR**

**Choose NestJS (TypeScript) for the application backend, with dedicated Python workers for the document-intelligence/AI pipeline.** Reasoning:

1. **Bounded contexts map directly to NestJS modules** with first-class dependency injection and clear boundaries — the cleanest expression of the "modular monolith, decomposable later" requirement. NestJS's built-in microservice transports make later extraction of a module into a service low-friction.
2. **Type safety end-to-end.** TypeScript gives compile-time correctness across a large financial codebase and **shares DTOs/contracts with the React/Next.js frontend** already chosen in the design docs — one language across the stack, fewer integration defects, faster team velocity.
3. **We don't lose the Python AI ecosystem.** The AI architecture already runs OCR/extraction/LLM work in **isolated queue workers** behind vendor APIs. Those workers are **written in Python** (best ecosystem for document AI/ML glue), communicating with the core over the queue/events. This split is a feature, not a compromise: the AI tier is physically separated from the core — which directly enforces the rule that **AI cannot mutate ledger/NAP/KEP/permissions** (the AI workers simply don't have those capabilities; they only emit suggestion events).
4. **Strong async/queue support** (BullMQ on Redis) for the required OCR/AI/report/SAF-T/submission workers; mature PostgreSQL access with RLS-compatible connection handling.
5. **Talent & speed:** abundant TypeScript/Node talent in the EU/BG market and high MVP velocity.

**When the choice would differ (honest caveats):**
- If the team is **Python-first** and wants AI *in-process*, **Django (ORM/admin) + FastAPI (async APIs) + Celery** is an equally defensible primary — strongest single-language AI story; the rest of this architecture maps cleanly onto it.
- If the team is **.NET-strong** and prioritizes raw performance and the most rigorous typing, **.NET** is excellent for fintech; the trade-off is a smaller startup talent pool and slower MVP.
- **Laravel** is the fastest to MVP and very common locally, but dynamic typing and a less natural fit for strict DDD/event-driven financial correctness make it the weakest fit for a long-lived accounting core.

**Net:** the architecture below is described in stack-neutral terms and works on any of the four; the concrete recommendation is **NestJS core + Python AI workers + PostgreSQL + Redis/BullMQ + EU object storage**, chosen for modular-context fit, end-to-end type safety with the frontend, clean AI isolation, and team velocity.

### 2.3 Supporting stack (recommended)
- **DB:** PostgreSQL (managed, EU region) + RLS + read replicas + partitioning; **pgvector** for AI retrieval; managed alternative: an EU Postgres provider (incl. Supabase-style) that exposes RLS.
- **Cache / queue:** Redis (cache + BullMQ queues).
- **Object storage:** EU S3-compatible with object-lock/immutability + lifecycle tiering.
- **Search:** PostgreSQL full-text at MVP → OpenSearch later.
- **AI workers:** Python services calling EU/zero-retention model & OCR endpoints.
- **Edge:** API gateway, WAF, TLS termination.
- **IaC + containers + managed orchestration**, all EU-region.

---

## 3. Modular Monolith Architecture

### 3.1 Principles
- **One deployable, many modules.** Each module = a bounded context from the domain model, with its own internal services, domain logic, and persistence ownership.
- **Explicit boundaries.** Modules expose narrow interfaces (application services) and communicate **in-process via those interfaces** for synchronous needs and **via domain events** for decoupled reactions. **No module reaches into another's tables.**
- **Shared kernel** only for cross-cutting value objects: tenant/company context, money/currency, identifiers, result/error types.
- **Decomposition seams pre-drawn.** Modules with distinct scaling/cost/security profiles — **DocIntel/AI, Reporting, Compliance** — are the first candidates to become independent services; their interfaces are already event/contract-based so extraction needs no caller changes.
- **Dependency direction** mirrors the domain context map: Identity/Tenancy underpin all; MasterData is referenced; DocIntel proposes into Invoicing/Ledger; Tax/Reporting read the ledger; Audit/Notification observe everything.

### 3.2 Internal communication rules
- **Synchronous (in-process call)** when a request needs an immediate, consistent result within one transaction (e.g. Invoicing asks Ledger to post on issue).
- **Asynchronous (domain event)** when reactions can be eventually consistent and decoupled (e.g. EntryPosted → update projections, notify, index for search). Events go through the **outbox** (Section 20).
- **No shared mutable state** between modules except via these channels; the cache is namespaced per module/tenant.

---

## 4. Backend Modules

Each module owns its aggregates (from the domain model), application services, and persistence; lists below name responsibility + key async work.

| Module | Owns / responsibility | Emits / consumes (key events) | Async workers |
|--------|----------------------|-------------------------------|---------------|
| **Identity** | Users, sessions, MFA, KEP-auth, roles, permissions | UserInvited, RoleChanged | — |
| **Tenancy** | Tenants, organizations (firms), companies, subscriptions, entitlements, usage metering | CompanyCreated, EntitlementChanged | usage rollups |
| **MasterData** | Counterparties, products, bank accounts, fiscal calendar, chart of accounts, tax codes, exchange rate | CounterpartyValidated | VIES validation worker |
| **DocIntel** | Documents, ingestion, extractions, classification, AI suggestions, learning profile, review items | DocumentReceived, Extracted, SuggestionReady; consumes uploads | **OCR + AI workers** |
| **Invoicing** | Sales documents, lines, numbering, payments, receivables | InvoiceIssued, PaymentRecorded | email/send worker |
| **Ledger** | Journal entries/lines, periods, balances, posting, period control | EntryPosted, PeriodLocked | balance projection |
| **Tax** | VAT periods, registers, returns, VIES, validation center | VatPeriodAssembled, ReturnValidated | register assembly |
| **Compliance** | NAP submissions, SAF-T exports, signatures, certificates, obligations | SubmissionFiled, SignatureApplied | **SAF-T + submission workers** |
| **Banking** | Bank accounts, statements, transactions, reconciliation | StatementImported, TransactionReconciled | **import + auto-match workers** |
| **Reporting** | Read models/projections, report runs | — (subscribes to many) | **report-build workers** |
| **Audit** | Append-only, hash-chained audit log; checkpoints | (subscribes to all) | chain checkpointing |
| **Notification** | Notifications, preferences, channels, delivery | (subscribes to events/obligations) | **delivery workers** |
| **AI Gateway** (infra) | Model gateway, prompt registry, RAG/retrieval, eval/observability hooks | — | (used by DocIntel/AI workers) |
| **Platform** (infra) | Outbox dispatcher, job scheduler, file-storage service, search indexer, feature flags, secrets | — | indexer, scheduler |

**Authority isolation note:** privileged commit services — `Ledger.post`, `Compliance.fileSubmission`, `Compliance.applySignature`, `Identity.changePermission` — are callable only by authenticated human-initiated, role-gated flows. **DocIntel/AI workers can emit `SuggestionReady` events but cannot invoke these commit services** (enforced by capability boundaries + RLS role, Sections 6/7/10).

---

## 5. API Architecture

- **Style:** primarily **REST/JSON** resource APIs over HTTPS, organized per module; a thin **BFF** layer tailors payloads for web vs mobile vs portal where helpful. Internal module-to-module calls use in-process interfaces, not the public API.
- **Tenant in every request:** the API gateway resolves the authenticated principal and the **active company/tenant** (from the session + company switcher) and injects it into a per-request context that flows to the data layer (Section 6). No endpoint trusts a client-supplied tenant id without authorization.
- **Idempotency:** mutating endpoints (create invoice, upload, post, submit) accept an **idempotency key**; replays return the original result — essential with retries and the at-least-once queue.
- **Pagination & filtering:** cursor-based pagination for large lists (ledgers, queues, documents); filter/sort contracts match the screen specs; every list query is tenant- and (usually) period-bounded.
- **Consistency contract:** writes are synchronous and transactional; some reads are eventually-consistent projections — endpoints document which, and the UI reflects processing states.
- **Errors:** a uniform error envelope (code, message, field errors, correlation id) — user-safe, never leaking internals (Section 25).
- **Contracts:** typed request/response schemas (shared with the TS frontend); documented; validated at the edge.
- **Rate limiting & abuse protection** at the gateway, with stricter limits on upload and AI endpoints.

## 6. Authentication & Authorization

### 6.1 Authentication
- **Methods:** email + password + **mandatory MFA** for staff/accountant roles; **KEP (QES) login** as strong-auth/step-up; SSO for firms (later).
- **Sessions/tokens:** short-lived access tokens + rotating refresh; server-tracked sessions/devices with revocation; **MFA-freshness** recorded for step-up gating of sensitive actions.
- **KEP auth** runs through the Compliance ACL to the QTSP; the platform never holds private keys.
- **Step-up:** sensitive actions (file to NAP, sign, change permissions, manage security) require recent MFA and the right role/condition (ABAC).

### 6.2 Authorization (overview; detail in §8)
Authorization is evaluated in layers on every request: **authenticated? → tenant/company membership? → role permits the action on this resource? → ABAC conditions (MFA freshness, KEP configured, period state) satisfied? → not blocked by a hard guardrail?** Only then does the request reach the application service, which executes under an RLS-scoped DB session.

## 7. Multi-Tenant Enforcement

Defense in depth — isolation is enforced at **three layers**, with RLS as the guaranteed backstop.

1. **Application layer:** every query/command runs within a **tenant/company context** resolved at the edge; repositories require the context; no query is constructed without it.
2. **Database layer (RLS — the backstop):** every tenant-scoped table has **Row-Level Security policies keyed on `tenant_id`** (and `company_id`). The app sets the **current tenant/company on the DB session** (a per-request connection-scoped setting / session variable) before any query; RLS policies restrict every read/write to matching rows. **Even a flawed query cannot cross tenants** — the database refuses.
3. **Connection discipline:** pooled connections set and reset the tenant context per request (never leak context between requests); privileged maintenance connections that bypass RLS are isolated and audited.

- **Tenant context propagation:** carried through the request → application service → repository → DB session, and onto **events and jobs** (every event/job payload includes `tenant_id`/`company_id`, re-applied when a worker processes it, so async work is equally RLS-scoped).
- **Object storage, search, cache, vector store** are all tenant-namespaced (Sections 22/24/25 of AI doc) — isolation holds outside Postgres too.
- **Cross-tenant access** is impossible by design and treated as a sev-1 defect if ever observed; isolation is part of the test suite (Section 30).
- **Large/dedicated tenants** can be promoted to a dedicated database/residency via a tenant `placement` attribute without code change.

## 8. RBAC & ABAC

- **Model:** **RBAC scoped by resource hierarchy** (tenant → company → object) + **ABAC conditions** for sensitive actions, exactly as the domain model defines (Membership for tenant role; CompanyAssignment for per-company role).
- **Policy evaluation:** a central **authorization service / policy engine** answers "may principal P perform action A on resource R under context C?" — consulted by application services before any privileged operation. Decisions are cacheable (short TTL + event-driven invalidation on role change).
- **ABAC conditions** include: MFA freshness, KEP configured for the company, period not locked, preparer ≠ approver (firm SoD policy), data-residency, entitlement/plan limits.
- **Hard guardrails (non-overridable, enforced in code + policy):**
  - **State submission (NAP) and KEP signing require an Approver role + KEP + step-up** — and **AI/workers are categorically excluded**.
  - **Permission changes** require Tenant Admin/Owner; last-admin protection.
  - **Cross-tenant** anything is denied.
  - **Ledger posting** requires the appropriate role; **AI cannot call the posting service** regardless of confidence.
- **AI as a constrained principal:** AI workers run under a **capability-limited identity** that can read scoped data and emit suggestion events but **holds no permission** to post, file, sign, or change access — so the authority boundary is enforced by identity/capability, not merely by convention.
- **Auditability:** every authorization decision for a sensitive action, and every role/permission change, is audited (Section 19).

---

## 9. Document Upload Pipeline

```
client ──upload──▶ API (authz + tenant context + idempotency key)
   └─▶ stream to EU object storage (original, immutable) + compute content hash
   └─▶ create Document (status=received) in PG (RLS-scoped) within a txn
   └─▶ emit DocumentReceived via outbox
        └─▶ enqueue: malware-scan job → on clean → classify/OCR job
return 202 immediately (UI shows "processing"); duplicates (same hash) short-circuit
```
- **Synchronous part is minimal:** persist original + metadata + emit event; everything heavy is async.
- **Malware scan + sandboxed parsing** before any processing; ZIP expanded into child Documents; XML routed to native parse (skip OCR).
- **Idempotent:** re-upload of the same hash links to the existing Document instead of duplicating.
- **Email-in/portal** uploads enter the same pipeline as IngestionItems.

## 10. OCR Processing Workflow

```
queue: ocr ──▶ Python OCR worker (tenant context re-applied, RLS-scoped)
   ├─ pre-process image (de-skew/crop/enhance) or extract embedded PDF text
   ├─ call EU OCR/Vision-LM endpoint (zero-retention)
   ├─ persist text + layout + per-region confidence (Extraction) within txn
   └─ emit OcrCompleted → enqueue extraction job
```
- **Dedicated worker pool**, autoscaled; retries with backoff; failures route to "re-shoot/manual" state, never lost.
- Worker runs under the **capability-limited AI identity** (read scoped doc, write extraction only — cannot post/file/sign).
- **Idempotent** (keyed on document + extraction run id); results cached by content hash to avoid re-OCR.

## 11. AI Processing Workflow

```
queue: ai ──▶ AI worker (Python; tenant context; capability-limited)
   ├─ structured extraction (Vision-LM) → ExtractedFields (+confidence, location)
   ├─ deterministic ValidationChecks (EIK/VIES/IBAN/net+VAT=total/duplicate)
   ├─ invoke Rules Engine (Section 12) → proposal (posting + VAT + categorization)
   ├─ persist Extraction + AISuggestion + RuleTrace (read/scoped) within txn
   └─ emit SuggestionReady → DocIntel creates a ReviewItem (or auto-apply gate)
```
- **AI writes only suggestion/extraction data — never ledger/NAP/KEP/permissions** (no capability to do so).
- **Auto-apply** is decided by the Rules Engine's AI Override Rules; if eligible, a **separate human-context or system-posting service** (not the AI worker) performs the post, fully audited and reversible.
- EU/zero-retention model calls; tenant-isolated retrieval/learning; everything traced (model/prompt version) for audit (Section 19).

## 12. Accounting Rules Engine Integration

- **Where it runs:** as an in-process **domain service** invoked by the AI worker (for document-driven proposals) and by Invoicing/Banking/Period-close flows; it is **deterministic and stateless per evaluation** (rules are data, loaded from versioned rule sets).
- **Inputs:** normalized event + master data + company/counterparty learned profile (tenant-scoped).
- **Process:** resolve applicable rules **as-of the event date** → select (specificity) → calculate (VAT/amounts/schedules) → validate (constraints) → compliance gate → emit a **Proposal + RuleTrace**.
- **Output is a proposal only** — a draft entry/VAT/categorization with confidence and trace. The engine **does not write the ledger**; it hands the proposal to the human-in-the-loop/posting path.
- **Versioned & auditable:** every proposal pins the rule/model/prompt versions used (Section 19); rule changes are audited; rollback is forward-looking (per the Rules Engine doc).

## 13. Ledger Posting Workflow

```
posting service (human-initiated approval OR gated auto-apply — never AI worker)
   ├─ authz: role permits posting + period OPEN + RLS-scoped
   ├─ BEGIN txn:
   │    ├─ assert double-entry balance (Σdr = Σcr)  ← invariant, refuse if violated
   │    ├─ append JournalEntry + JournalLines (IMMUTABLE; no update/delete)
   │    ├─ write AuditEvent (actor + before/after) — same txn
   │    └─ write outbox: EntryPosted
   │  COMMIT
   └─ async: projections (LedgerBalance/TrialBalance), VAT register, search index, notify
```
- **Immutable:** posted entries are never edited/deleted; corrections create **reversing entries** in an open period.
- **Period control:** posting into a **locked** period is refused (compliance constraint); corrections to filed periods go through the controlled amendment workflow.
- **Atomic event emission:** the `EntryPosted` event is written in the **same transaction** (outbox) — no posting without its event, no event without its posting.
- **AI exclusion:** the AI worker cannot call this service; only human-approval flows and the gated auto-apply system-context (itself bounded by AI Override Rules) reach it.

## 14. VAT Workflow

```
period assembly worker (queue) ── from approved postings ──▶ VatLedgerEntries (purchase/sales)
   ├─ run VAT validation (deterministic) → VatValidationIssues (block/warn)
   ├─ assemble VatReturn (+ VIES) draft  ── all derived, none hand-entered
   └─ emit VatPeriodAssembled
gated stepper (synchronous, human): validate → approve (SoD) → sign(KEP) → file(NAP) → lock
```
- Registers and returns are **derived from the immutable ledger**, never separately entered.
- Blocking validation issues prevent advancing the stepper; warnings require acknowledgment.
- Filing transitions are human + Approver + KEP gated; on success the **period locks** and a confirmation is archived.

## 15. NAP Submission Workflow

```
filing flow (human, Approver, step-up) ── behind Compliance ACL ──▶ NRA channel
   ├─ generate SubmissionArtifact (NAP-compliant file / SAF-T XML) — versioned schema
   ├─ KEP sign artifact (Section 16) → record Signature
   ├─ submit: MVP = produce file + guided portal upload; later = direct submission
   ├─ on accept: store SubmissionConfirmation (immutable); else FAILED (retain artifacts, retry)
   └─ write AuditEvent + emit SubmissionFiled; idempotent (no double-file per period/type)
```
- **ACL isolates** the volatile NRA/SAF-T schema; **SAF-T generation runs on a queue worker** (heavy), but **submission/signing is human-gated and synchronous**.
- **AI excluded;** Approver + KEP required; everything immutable + audited.

## 16. KEP Signing Workflow

```
signing flow (human) ──▶ KepSignPanel ──▶ Compliance ACL ──▶ QTSP (cloud/token/mobile)
   ├─ present exact artifact + hash (never blind)
   ├─ authenticate with qualified cert (platform NEVER holds private keys)
   ├─ apply + verify signature → persist Signature (artifact ref, signer, cert, timestamp)
   └─ write AuditEvent; only a VERIFIED signature counts; failures recover cleanly
```
- Provider-agnostic via the ACL; certificate validity/revocation checked at signing time.
- The `Signature` record is **immutable**; referenced by NAP submissions and the audit chain.

## 17. Bank Import & Reconciliation Workflow

```
import worker (queue) ── parse MT940/CAMT.053/CSV/XLSX (format-detected) ──▶ BankTransactions
   ├─ dedup by statement hash; persist within txn; emit StatementImported
auto-match worker (queue) ── propose ReconciliationMatches (confidence) ──▶ review/auto
reconcile (human or confident-auto): accept/split/create-entry → TransactionReconciled
```
- **Parsing + auto-match are async workers**; reconciliation decisions are human (or confident auto), producing adjusting entries via the **posting service** (not the worker).
- Idempotent imports (hash); partials/fees/FX handled in matches.

## 18. Invoicing Workflow

```
issue invoice (human) ──▶ Invoicing service (synchronous, txn)
   ├─ assign sequential number (gapless, per series) ← concurrency-safe
   ├─ validate mandatory BG fields + VIES (override-with-reason) 
   ├─ post to ledger via posting service (same logical flow) + open Receivable
   ├─ write AuditEvent + emit InvoiceIssued
   └─ async: render PDF (Document), send email (worker, delivery-tracked)
```
- **Sequential numbering** is a guarded, concurrency-safe operation (no gaps/reuse — legal requirement).
- Proforma issues **without** posting; convert-to-invoice assigns a real number and posts.
- Email send is an async worker with delivery tracking + retry; an issue never fails because email failed (issued-but-not-sent state).

---

## 19. Audit Trail Implementation Architecture

- **Append-only, hash-chained.** Every sensitive action writes an `AuditEvent` (actor — human/AI/system, action, target, before/after or diff, reason, timestamp) with a **`prev_hash` → `this_hash`** chain per tenant. No update/delete path exists for audit rows.
- **Written in the same transaction** as the state change it records (so a committed change always has its audit row, and vice-versa) — for ledger posts, submissions, signatures, permission changes, approvals, and rule changes.
- **Immutability enforcement:** the audit table is write-once at the application layer; at the DB layer, RLS + restricted grants prevent update/delete; periodic **`AuditChainCheckpoint`s** seal spans and make tamper-detection fast (recompute chain).
- **AI as a named actor:** every AI-originated suggestion/decision is attributable; postings link to the originating suggestion + RuleTrace (lineage: document → extraction → suggestion → rules → posting).
- **Distinct from logs:** the audit trail is **evidence** (regulatory, immutable, tenant-scoped, queryable per record); operational logs (Section 26) are separate and ephemeral.
- **Access:** readable by Reviewer/Auditor/Approver roles; exportable for auditors/NRA; itself access-controlled and audited.

## 20. Domain Events & Outbox Pattern

```
write txn: { mutate aggregate + insert AuditEvent + INSERT outbox row } COMMIT
outbox dispatcher (poll/CDC) ──▶ event bus ──▶ subscribers (in-proc) / enqueue (workers)
   mark outbox row dispatched (at-least-once)
```
- **Transactional outbox** guarantees **no event is lost and none is emitted without its state change** (both commit together). The dispatcher relays to in-process subscribers and/or the queue.
- **At-least-once delivery + idempotent consumers** (keyed by event id) — consumers tolerate redelivery (no double-posting, no double-notify).
- **Ordering** preserved per aggregate stream (per company/aggregate) where it matters; subscribers track checkpoints.
- **Subscribers:** Reporting projections, Audit, Notification, search indexer, AI pipeline triggers — each independent and rebuildable by replaying the event log.
- **MVP transport:** Postgres-backed outbox + Redis/BullMQ; can graduate to a dedicated broker (e.g. when contexts split into services) without changing producers.

## 21. Background Jobs & Queues

- **Queue tech:** Redis + **BullMQ** (NestJS) for app-triggered jobs; Python workers consume the same queues for OCR/AI. (A Postgres-based queue is a viable lower-dependency alternative at MVP.)
- **Worker classes (as required):** **OCR**, **AI/extraction+suggestion**, **report-build**, **SAF-T generation**, **NAP submission prep**, plus bank-import/auto-match, email/notification delivery, projection rebuilds, VIES validation, scheduled tasks.
- **Per-queue isolation & concurrency:** separate queues/pools per class so a slow SAF-T build doesn't starve OCR; autoscale workers on queue depth (absorbs month-end / 14th-of-month spikes).
- **Reliability:** retries with exponential backoff, **dead-letter queues** for poison jobs, **idempotency keys** (no double effects), visibility timeouts, job-level tracing.
- **Tenant context on every job:** payloads carry `tenant_id`/`company_id`, re-applied to the DB session in the worker (RLS-scoped). Workers run under appropriate (often capability-limited) identities.
- **Scheduling:** cron-like scheduler for deadline reminders, period-close prompts, recurring imports, KB refresh, checkpointing.
- **Priority & fairness:** critical (submission/sign prep) > interactive (OCR for a waiting user) > bulk (report rebuilds); per-tenant fairness so one large firm can't monopolize workers.

## 22. File Storage Architecture

- **EU S3-compatible object storage** for all binaries: original documents (immutable), generated PDFs, submission artifacts, SAF-T files, exports.
- **Immutability:** originals and signed/submitted artifacts use **object-lock/WORM**; never overwritten — new versions are new objects (mirrors `DocumentVersion`).
- **Encryption:** at rest (KMS, envelope encryption) + in transit; per-tenant key scoping where warranted.
- **Access:** the app issues **short-lived, scoped signed URLs**; no public buckets; access logged. Tenant-namespaced key paths; never personal data in object keys.
- **Lifecycle/tiering:** hot for recent, cold/archive for closed years; disposition only when **RetentionSchedule** allows and **no LegalHold** (Section 28).
- **Integrity:** content hashes stored in PG for dedup + tamper detection; artifact hashes referenced by signatures/audit.

## 23. Reporting & Read Models

- **CQRS-lite:** reads for dashboards, ledgers, trial balance, VAT registers, aging, and firm rollups come from **projections/read models** maintained from domain events — **never live-aggregating the full ledger**.
- **Projections:** `LedgerBalance`, `TrialBalanceSnapshot` (per period), `Receivable/Payable` aging, dashboard KPIs, `FirmRollup` (firm tenant only). Updated incrementally on events; **rebuildable** by replaying the event log (resilience + schema evolution).
- **Materialized views / snapshot tables** for heavy reports; **read replicas** serve reporting/dashboards, isolating them from the write path.
- **Report runs:** parameterized report generation (P&L, balance sheet, VAT, management) runs on **report-build workers**; results snapshotted (immutable) for audit/sharing; multi-language; exportable to PDF/XLSX; shareable to the client portal.
- **Period close** snapshots opening/closing balances so each period query starts from a known base.
- **Tenant/firm scoping** strictly enforced on every projection (RLS + namespacing).

## 24. Search Architecture

- **MVP: PostgreSQL full-text search** for documents/counterparties/invoices — adequate, one fewer dependency, RLS-scoped.
- **Scale-out: OpenSearch/Elasticsearch** when volume/relevance demands; populated via the **search indexer** subscribing to domain events; tenant-partitioned indices.
- **Document dedup:** content-hash + fuzzy fingerprint index (supplier/number/amount/date) powering duplicate detection.
- **AI retrieval (pgvector):** semantic retrieval for RAG lives alongside, **tenant-partitioned** (per the AI doc), distinct from keyword search.
- **Isolation:** every search/retrieval is tenant-scoped at the index/partition level — a cross-tenant hit is a sev-1 defect.

---

## 18b. Notification System

(Covering the requested "Notification System" topic.)

- **Event-driven:** notifications are produced by subscribers to domain events (EntryPosted, SuggestionReady, ReturnValidated, SubmissionFiled/Failed, client uploads) and to `ComplianceObligation`/`Anomaly` (deadlines, risks). No polling-by-UI for state.
- **Pipeline:** event → notification rule (type, severity, audience, grouping by company) → `Notification` persisted (RLS-scoped) → **delivery workers** dispatch to channels (in-app, email, push) per `NotificationPreference`.
- **Channels & reliability:** per-channel `DeliveryAttempt` with retries/backoff; critical types (deadline/compliance) are never silently dropped (failures surfaced/escalated).
- **Firm grouping:** notifications group by company in firm mode; escalation as deadlines near (info → attention → urgent).
- **Deep-linking:** each notification references its subject entity so the client can navigate straight to the action.
- **Tenant-scoped & audited** like everything else; preferences are per-user.

---

## 25. Error Handling

- **Layered error model:** domain errors (business-rule violations, e.g. unbalanced entry, locked period) vs validation errors (input) vs infrastructure errors (DB/queue/vendor). Each maps to a stable code + user-safe message + correlation id.
- **Transactional integrity:** write operations are atomic; on failure the transaction rolls back **including the outbox row** (no orphan events). No partial postings.
- **Async failures:** worker failures retry with backoff; exhausted jobs go to a **dead-letter queue** with context for inspection; the originating entity reflects a clear failure state (e.g. "extraction failed — manual entry"), never a silent loss.
- **Compensation over rollback for cross-step flows:** where a multi-step async flow can't be a single transaction, failures trigger compensating actions (e.g. mark submission FAILED, retain artifacts) rather than corrupting state.
- **Idempotency** everywhere a retry is possible (API keys, event ids, job keys) so re-execution is safe.
- **User-facing:** calm, actionable messages (per UX), never leaking internals; distinguishes blocking errors from warnings; preserves user input.
- **External/vendor errors (NRA/VIES/bank/LLM):** wrapped by ACLs; degrade gracefully (proceed-with-flag, retry, or queue) so capture and core workflows keep working.

## 26. Logging & Observability

- **Structured logging** (JSON) with a **correlation/request id** propagated across API → services → events → workers, so one user action is traceable end-to-end. **Tenant id is logged; PII is not** (or is redacted).
- **Distinct from audit:** logs are operational/ephemeral (debugging, performance); the **audit trail is immutable evidence** (Section 19). They are never conflated.
- **Distributed tracing** across the modular monolith and workers (spans for API, DB, queue, vendor calls).
- **Metrics & SLOs:** latency/throughput/error rates per module and queue depth per worker class; business metrics (documents processed, suggestion acceptance, postings, filings) and **per-tenant cost/usage** (AI, storage).
- **Alerting:** on error-rate/latency/queue-depth/SLO breaches, drift in AI quality, and **security signals** (cross-tenant guard trips, injection attempts, auth anomalies); on-call paging for sev-1.
- **Dashboards:** ops health, AI quality (per AI doc), compliance pipeline health (filings due/failed), and tenant usage.

## 27. Security Architecture

(Defense-in-depth; security-architect lens.)

- **Identity & access:** MFA-mandatory for staff, KEP step-up, short-lived tokens + session revocation, RBAC+ABAC with non-overridable guardrails (Section 8). **AI runs under a capability-limited identity** with no privileged mutations.
- **Tenant isolation:** three-layer enforcement with **RLS as the guaranteed backstop** (Section 7); isolation verified in tests; a breach is sev-1.
- **Data protection:** TLS everywhere; encryption at rest (DB, object storage, backups) via **KMS** with rotation; field-level encryption for the most sensitive identifiers.
- **Input hardening:** malware scanning + **sandboxed parsing** of untrusted files; defenses against **XXE (XML), ZIP bombs, malicious macros**; strict format handling; size/type limits; rate limiting on upload/AI endpoints.
- **Prompt-injection defense (AI):** all document/extracted/user content is **data, not instructions**; AI has no tools to take privileged actions even if "instructed" (Section 23 of AI doc) — enforced architecturally, not by prompt alone.
- **App security:** OWASP Top 10 coverage (injection, broken access control, SSRF, etc.), parameterized queries, output encoding, dependency/secret scanning, SAST/DAST in CI.
- **Secrets:** managed vault/KMS; no secrets in code/config/repos; per-environment isolation; least-privilege service identities.
- **Network:** WAF at the edge; private networking for DB/queue/storage; no public data stores; egress controls for outbound vendor calls (EU endpoints only).
- **Auditability:** all sensitive actions + auth decisions + admin access audited (Section 19); KEP private keys never held.
- **ISO 27001-ready** controls; documented incident response + breach notification readiness.

## 28. GDPR Architecture

- **EU residency** for all primary data, backups, object storage, search/vector indices, and AI processing endpoints; data never leaves the EU boundary; **tenant `placement`** supports stricter residency.
- **PII mapping:** entities holding PII are mapped (per domain model) enabling targeted access control, export, and erasure.
- **Lawful processing & sub-processors:** DPAs with all sub-processors (model/OCR/email/storage vendors) on **zero-retention/no-training** terms; processing-purpose tracking; minimization (only needed data sent to vendors; redaction where possible).
- **Data-subject rights:** export and **erasure via `ErasureRequest`**, reconciled with **statutory retention + `LegalHold`** — where deletion is legally barred (tax records), anonymization/partial erasure is applied and documented; erasure scope includes learned profiles/embeddings where required.
- **Retention:** `RetentionPolicy`/`RetentionSchedule` drive disposition (archive/anonymize/delete) only when no hold applies (Section 22 storage lifecycle).
- **Breach readiness:** detection + 72-hour notification process; audit trail supports forensics.

## 29. Performance & Scaling

- **Stateless app tier** behind a load balancer → horizontal scale; state in PG/Redis/queue/object storage.
- **Async-first:** queue workers absorb OCR/AI/report/SAF-T/submission load and **month-end / 14th-of-month spikes**; capture/UI return immediately.
- **Read scaling:** projections + **read replicas** for dashboards/reports/ledgers; never live-aggregate the ledger.
- **DB scaling:** **partitioning** (time/period + tenant) for high-volume append-only tables (journal lines, bank transactions, audit, events, notifications); composite indexes leading with `tenant_id`/`company_id` + date/status; hot/cold tiering; large tenants promotable to dedicated DBs.
- **Caching:** reference/master data (chart of accounts, VAT rates, exchange rate), permission decisions (short TTL + event invalidation), and AI extraction results (by content hash).
- **AI cost/perf:** native-parse-before-OCR, model tiering, batching, confidence gating, per-tenant metering (per AI doc).
- **Decomposition path:** extract **DocIntel/AI, Reporting, Compliance** into independent services first (distinct scaling/cost/security profiles); event/contract interfaces make this caller-transparent.
- **Reliability:** multi-AZ within the EU region; graceful degradation (vendor down → manual/queue paths still work); circuit breakers around NRA/QTSP/bank/VIES/LLM; defined RPO/RTO.

## 30. Testing Strategy

- **Unit:** domain logic per module (rules engine selection/validation, VAT/depreciation math, numbering).
- **Property-based / invariant tests** for the **ledger**: random valid scenarios must always preserve double-entry balance and immutability; reversals fully offset.
- **Integration:** module + PG (with **RLS policies active**) + queue; verify outbox→event→consumer flows and idempotency (replays don't double-post).
- **Multi-tenant isolation tests (mandatory):** assert no query/endpoint/job/search/retrieval can cross `tenant_id`, including under RLS bypass attempts — a failing case is sev-1.
- **Contract tests:** API request/response and event payload schemas (shared with frontend); ACL contracts for NRA/KEP/bank/VIES (against recorded fixtures).
- **Workflow/e2e:** document→suggestion→approve→post→VAT→sign→file happy path + failure paths.
- **Compliance/accounting correctness:** golden-file tests for VAT registers/returns, SAF-T structure (against schema versions), trial-balance balancing across the EUR/BGN boundary.
- **AI evaluation harness:** extraction accuracy, acceptance/override/hallucination, confidence calibration, regression gates (per AI doc) — separate from app tests but in CI gates.
- **Security tests:** authz/RBAC/ABAC, injection (incl. document-borne prompt injection), file-upload hardening, RLS enforcement; SAST/DAST/dependency scanning in CI.
- **Performance/load:** month-end spike simulation on the queue and read paths.

## 31. API Versioning

- **Explicit versioning** (URI prefix `/v1` or version header) for the public/BFF API; internal module interfaces version independently.
- **Backward-compatibility policy:** additive changes within a version (new optional fields/endpoints); breaking changes require a new version with an overlap/deprecation window and clear migration notes.
- **Contract stability:** shared typed schemas; consumer-driven contract tests prevent silent breakage; events are **versioned payloads** with tolerant readers (consumers ignore unknown fields).
- **Deprecation:** sunset headers/notices; analytics on version usage before removal.
- **Mobile awareness:** the mobile client may lag the web; the API supports at least one prior version during rollout windows.

## 32. Admin & Support Tools

- **Internal admin console** (separate from tenant-facing app): tenant/subscription/entitlement management, data-residency/placement, feature flags, KB/jurisdiction-pack version management, model/prompt version control, queue/job inspection + DLQ replay.
- **Support access is privileged and constrained:** **impersonation/elevated access requires justification, is time-boxed, RLS-scoped to the specific tenant, and fully audited** (the support actor is a named principal in the audit trail). No standing god-mode; least privilege.
- **Operational tooling:** projection rebuild triggers, event replay, reconciliation of outbox, retention/erasure execution (with hold checks), and integrity verification of the audit hash chain.
- **Safety:** admin/support tools **cannot bypass** the immutable-ledger or AI-exclusion guarantees; destructive actions are guarded, audited, and (where relevant) require dual control.
- **Observability access** (logs/traces/metrics/dashboards) with PII redaction.

## 33. Deployment Considerations

- **EU-region cloud** (or EU sovereign cloud) for all environments; **infrastructure-as-code**; containerized workloads on managed orchestration; separate dev/staging/production with isolated secrets and data (production data never copied unmasked to lower environments).
- **CI/CD:** automated build/test/scan → staging → production; **blue/green or rolling** deploys; the modular monolith deploys as one unit, workers scale independently.
- **Database migrations:** versioned, forward-only-friendly, applied with care for the immutable/append-only tables; RLS policies are part of the migration set and tested.
- **Configuration & flags:** environment config via vault; **feature flags** for staged rollout and per-tenant entitlements (e.g. SAF-T, direct NAP submission).
- **Resilience:** multi-AZ; encrypted, EU-redundant **backups** with tested restores; documented **DR** (RPO/RTO) and incident response; circuit breakers + health checks; autoscaling on CPU/queue-depth.
- **Observability wired from day one** (logs/traces/metrics/alerts); **audit-chain checkpointing** scheduled.
- **Decomposition-ready:** services extracted later deploy as additional units consuming the same event bus/queue; no big-bang rewrite.

---

## Closing — how the backend holds together

- **One deployable, clean seams:** a modular monolith whose modules are the bounded contexts, talking via narrow interfaces and an **outbox-backed event bus**, ready to split (DocIntel/AI, Reporting, Compliance first) without rewriting callers.
- **PostgreSQL + RLS as the spine:** every action is tenant-scoped at the app layer and **guaranteed by RLS** at the database; the ledger is **immutable** and the audit log is **append-only and hash-chained**.
- **Async where it matters:** **queue workers** for OCR, AI, reports, SAF-T, and submissions absorb spikes and external dependencies; capture never blocks; everything is idempotent.
- **Authority is structural:** privileged commit services (post, file, sign, change permissions) are role-gated, step-up-protected, audited, and **physically out of reach of the AI workers**, which hold a capability-limited identity and can only propose.
- **EU, secure, observable, compliant by construction:** EU residency, KMS encryption, OWASP + injection (incl. document-borne) defenses, GDPR retention/erasure reconciled with statutory holds, and full observability + testing — including mandatory multi-tenant-isolation and ledger-invariant tests.
- **Recommended stack:** **NestJS (TypeScript) core + Python AI/OCR workers + PostgreSQL (RLS, replicas, partitioning) + Redis/BullMQ + EU S3-compatible storage**, chosen for bounded-context fit, end-to-end type safety with the frontend, clean AI isolation, and team velocity — with Python (FastAPI/Django + Celery) the strong alternative if the team is Python-first.

This backend architecture realizes the prior seven documents as a buildable, safe, compliant system: capture → understand (AI workers) → propose (rules + AI) → human approve → record (immutable ledger) → comply (VAT/NAP/KEP/SAF-T) — every step tenant-scoped, audited, and EU-resident.

*End of v1.0 Backend Architecture.*
