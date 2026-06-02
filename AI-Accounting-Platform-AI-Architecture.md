# AI Accounting Platform — Complete AI Architecture

**Document type:** AI architecture (conceptual — no code/implementation)
**Builds on:** Master Architecture, UX Architecture, Design System, Screen Specs, Domain Model & Data Architecture, Rules Engine Architecture (all v1.0)
**Acting as:** Senior AI Architect · Document Intelligence Architect · Accounting Automation Architect · Security Architect
**Status:** v1.0 — AI baseline

---

## Guiding principles (the spine of the AI design)

1. **The AI proposes; it never commits.** No AI subsystem posts to the ledger, signs, or files to the state. Outputs are *proposals* that flow through the human-in-the-loop pipeline. The AI is a **named, audited non-human actor**.
2. **Deterministic over probabilistic.** Anything checkable (EIK checksum, VIES, IBAN, arithmetic, double-entry, VAT correctness) is decided by **deterministic validators/rules**, which always outrank the model. The LLM is used for *reading, reasoning, suggesting, and explaining* — not for facts it could fabricate.
3. **Grounded, cited, abstaining.** Conversational and analytic outputs are grounded in the company's own ledger/documents and a curated Bulgarian tax knowledge base, with **citations**; numbers come from the ledger, never the model; when unsure, the AI **abstains and defers**.
4. **Tenant-isolated by construction.** Retrieval, learning, embeddings, and caches are scoped to one tenant/company; no customer data crosses `tenant_id`, and customer data is **never used to train shared models**.
5. **All untrusted content is data, not instructions.** Document text (OCR'd or parsed) is treated as untrusted input and can never trigger an action — the core defense against document-borne prompt injection.
6. **Cost-aware and observable.** Model tiering, native-parse-before-OCR, caching, and confidence gating keep marginal cost down; everything is metered, traced, and evaluated.

---

## 1. AI System Overview

### 1.1 The four AI subsystems (and their authority)

| Subsystem | Job | Primary tech | Authority |
|-----------|-----|--------------|-----------|
| **Document Intelligence** | Read & extract structured data from documents | OCR / Vision-LM + deterministic validators | Proposes data |
| **Accounting Automation** | Suggest postings, VAT treatment, categorization; detect anomalies | Rules engine (deterministic) + LLM gap-fill + ML | Proposes postings |
| **Conversational AI** | Answer & explain (AI Accountant) and advise (AI CFO) | LLM + RAG (+ forecasting for CFO) | Advises only |
| **Learning & Quality** | Improve from corrections; evaluate; monitor | Feedback loop + eval harness + observability | Governs the others |

None can approve, sign, or file. None can override a compliance/validation constraint (per the Rules Engine's authority axis).

### 1.2 Layered architecture

```
 INPUT          ┌──────────────────────────────────────────────────────┐
 documents,     │  CAPTURE (upload / email-in / portal / mobile photo)  │
 questions ────▶└───────────────────────┬──────────────────────────────┘
                                         ▼
        ┌────────────────────────────────────────────────────────────┐
        │  DOCUMENT INTELLIGENCE PIPELINE (async, idempotent)          │
        │  classify → OCR/parse → extract → validate(det.) → suggest   │
        └───────────────────────┬───────────────────────┬─────────────┘
                                 ▼                       ▼
        ┌────────────────────────────────┐   ┌──────────────────────────┐
        │ ACCOUNTING AUTOMATION           │   │ CONVERSATIONAL AI         │
        │ Rules engine (det.) + LLM gap   │   │ AI Accountant · AI CFO    │
        │ + anomaly/risk + confidence     │   │ (LLM + RAG + forecasting) │
        └───────────────┬────────────────┘   └────────────┬─────────────┘
                        ▼                                   ▼
        ┌────────────────────────────────────────────────────────────┐
        │  HUMAN-IN-THE-LOOP (Review Queue / approvals)                │
        │  auto-apply (gated) | correct | approve | reject             │
        └───────────────────────┬──────────────────────────────────────┘
                                 ▼
                 LEDGER (immutable)  ·  AUDIT (AI as actor)
        ┌────────────────────────────────────────────────────────────┐
        │  LEARNING & QUALITY: feedback loop · evaluation · monitoring │
        │  PLATFORM: model gateway · vector store · KB · cost/obs.     │
        └────────────────────────────────────────────────────────────┘
```

### 1.3 Shared AI platform services
A **model gateway** (vendor-abstracted, EU endpoints, zero-retention), a **vector store** (per-tenant retrieval), the **Bulgarian tax knowledge base**, a **prompt registry** (versioned), an **evaluation harness**, and **cost/observability** instrumentation. These are shared infrastructure; the four subsystems consume them.

---

## 2. Document Intelligence Pipeline

The pipeline turns a raw capture into a validated, suggestion-ready fact. It is **event-driven, asynchronous, and idempotent** (reprocessing never double-posts — keyed on content hash + event id).

### 2.1 Stages

```
① INGEST        store original (immutable) · malware scan · content hash (dedup)
② ROUTE         format detection → structured path (XML) or document path (image/PDF/TIFF)
③ CLASSIFY      document type (purchase/sales invoice · receipt · bank statement · contract)
④ READ          OCR / Vision-LM (document path)  |  native parse (structured path)
⑤ EXTRACT       key-value fields + line-item tables → normalized values + locations + confidence
⑥ VALIDATE      deterministic: EIK · VAT/VIES · IBAN · net+VAT=total · duplicate · completeness
⑦ SUGGEST       Accounting Automation: posting + VAT + categorization (+ confidence, reasoning)
⑧ GATE          AI Override Rules: auto-apply (eligible) or → Review Queue
⑨ EMIT          proposal + RuleTrace + extraction trace → review/post → audit
```

### 2.2 Pipeline properties
- **Each stage emits a domain event** (DocumentReceived, Classified, Extracted, Validated, Suggested) consumed downstream and by observability.
- **Confidence accrues** through stages; deterministic validation can *raise* a field to "validated ✓" (fact) or *lower/flag* it.
- **Quality gates** can short-circuit: unreadable image → re-shoot prompt; structured XML → skip OCR; high-confidence + clean → auto-apply eligible.
- **Heavy steps run on autoscaling workers** to absorb month-end / VAT-deadline spikes; capture returns immediately and the UI updates via events.
- **Full trace persisted** per document: which engine read it, model/version, per-field confidence, validations, suggestions — the explainability + audit substrate.

---

## 3. OCR Architecture

OCR (and increasingly **Vision-Language extraction**) is the "read pixels" layer of the document path.

- **When OCR runs:** only on the **document path** (images, scanned/photographed PDFs, TIFF). Structured inputs (XML e-invoices) **skip OCR entirely** (Section 6).
- **Engine strategy (abstracted):** a managed document-AI service (EU region) for production accuracy, with an open-source engine as a cost/fallback option; the choice sits behind the model gateway so engines can be swapped or mixed per document type/cost.
- **Layout-aware reading:** beyond raw text, the layer captures **spatial layout** (blocks, tables, key-value regions) and per-token **bounding boxes** — enabling the Review Queue's field-highlight-on-document feature and robust table (line-item) extraction.
- **Languages & scripts:** **Bulgarian Cyrillic + Latin** are first-class (with Bulgarian letterform handling), plus English and common EU vendor languages for cross-border invoices.
- **Print + reasonable handwriting:** printed text is primary; handwritten amounts/notes handled best-effort with lower confidence (flagged for review).
- **Output:** raw text + layout + per-region confidence, handed to extraction (Section 4). OCR confidence is one input to the field confidence score, not the final word — deterministic validation can override it.

---

## 4. Invoice Extraction Architecture

Turning read text/layout into the structured accounting field set.

### 4.1 What is extracted
The full set the domain model requires: **supplier, customer, VAT number, EIK, invoice number, date(s), net amount, VAT amount, total amount, currency, IBAN, description**, plus **line items** (qty, unit price, VAT rate, line totals).

### 4.2 Approach
- **Layout-aware, schema-targeted extraction.** A Vision-LM / document-AI model performs **key-value extraction** (header fields) and **table extraction** (line items) against the target schema, rather than brittle position templates — so it generalizes across the many invoice layouts Bulgarian SMEs receive.
- **Light LLM normalization** maps messy raw values to canonical forms (date formats, decimal separators per locale, currency symbols, supplier name → known counterparty) — but **never invents** missing values; absent fields are marked missing, not guessed.
- **Per-field confidence + source location** are produced for every field (drives the review UI and auto-apply gating).
- **Counterparty resolution:** extracted supplier/VAT/EIK matched to existing `Counterparty` records (or proposed as new), feeding the learning loop.

### 4.3 Bulgaria specifics
EIK and `BG…` VAT number recognition + checksum/VIES validation; recognition of reverse-charge/intra-EU invoices; **EUR primary with BGN handling** for legacy/dual-period documents; mandatory-field awareness for Bulgarian invoices.

### 4.4 Determinism boundary
Extraction *proposes* values; **validation (Section 2⑥) decides truth** for anything checkable. Net+VAT=total is arithmetic, not an AI judgment; EIK/VAT/IBAN are deterministic checks. The model is trusted for *reading*, not for *verifying*.

---

## 5. Image / PDF Processing

Pre-processing that makes documents readable and routes them correctly.

| Input | Handling |
|-------|----------|
| **JPG / PNG** | auto-crop, de-skew, denoise, contrast/illumination enhancement; **blur/quality gate** → re-shoot prompt if too low to OCR |
| **Scanned PDF** | rasterize pages → image pipeline; multi-page navigation; detect "multiple invoices in one PDF" → offer split |
| **Digital (text) PDF** | extract embedded text directly where reliable (cheaper, more accurate than OCR); fall back to OCR for image-only pages |
| **TIFF** | multi-frame treated as multi-page; per-frame processing |
| **ZIP** | expanded; each contained file routed individually by its own type; unsupported/nested-unsupported flagged and skipped with a note |
| **Password-protected PDF** | prompt for password; never bypass |
| **Malicious content** | malware scan + sandboxed parsing; defenses against XXE (XML), ZIP bombs, malicious macros (Security, Section 23) |

Pre-processing is deterministic image/file handling — **no LLM** — and precedes OCR. Quality scoring here feeds the decision to OCR vs. ask for a better capture.

---

## 6. Structured Data Extraction

The fast, accurate, low-cost path for machine-readable inputs.

- **Native parsing, no OCR/LLM.** XML e-invoices (and, in future, UBL/Peppol when Bulgaria mandates e-invoicing) are **parsed deterministically** against their schema — fields are read directly, not inferred. The UI shows "Structured invoice detected — fields read directly," with higher default confidence.
- **Schema mapping via ACL.** External structured formats map to the internal model through an **anti-corruption layer**, so format/version churn (e.g. future Bulgarian e-invoicing schemas) never leaks into the core.
- **Same downstream path.** After parsing, structured documents rejoin the pipeline at **validation** (still checked: EIK/VIES/IBAN/arithmetic) and **suggestion**, so the accounting/VAT logic is uniform regardless of how data entered.
- **Priority over OCR.** When a structured representation exists, it is **always preferred** over OCR'ing a rendered copy — more accurate and far cheaper (Section 26).

---

## 7. AI Accounting Suggestions

- **Division of labor with the Rules Engine.** Posting suggestions are produced primarily by the **deterministic Posting Rules Engine** (specificity axis: learned → company → template → jurisdiction default). The **LLM fills gaps** only where no deterministic rule applies (novel supplier/category), proposing an account coding with reasoning.
- **What the AI contributes:** candidate account coding for unseen cases, narrative reasoning ("matches how you coded Supplier X 7×"), and **anomaly/risk detection** (unusual amount vs history, wrong-period dating, mismatched VAT) surfaced to the Recommendations Center.
- **Output:** a draft `JournalEntry` proposal with confidence, a plain-language explanation, and a `RuleTrace` showing deterministic-vs-AI provenance. Balanced double-entry is enforced by validation, not assumed by the model.
- **Boundary:** the AI never decides a *checkable* fact (amounts, VAT correctness, balance) — those are deterministic. It proposes *where judgment is needed* and always defers the final decision to the human (or the gated auto-apply path).

## 8. AI VAT Suggestions

- **Deterministic-first.** VAT **rate and treatment** are decided by the **VAT Rules Engine** (counterparty VAT status, place of supply, dates, effective-dated `TaxCode`). This is a jurisdiction hard constraint — not an AI guess.
- **Where AI helps:** **classification ambiguity** — e.g. is this expense category subject to reduced rate, or is a service intra-EU vs domestic — the LLM proposes a classification *that the deterministic rules then price and validate*. The AI also explains the treatment in plain language for the user.
- **Never:** the AI does not set a rate that contradicts the VAT rules; an AI proposal that would yield an incorrect treatment is vetoed by the compliance layer.
- **Output:** suggested treatment + the VAT-rules-computed amounts + deductibility, with a citation to the relevant rule (Section 18) for explainability.

## 9. AI Review Queue Logic

The logic that decides what humans see, in what order, and what they can bulk-approve (UX: SCR-REV-01/02).

- **Eligibility for the queue:** any proposal not auto-applied (Section 14) — i.e. anything below the auto-apply confidence/risk bar, flagged, novel, or conflicting.
- **Prioritization:** sorted by a blend of **confidence (ascending — riskiest first)**, **flags** (duplicate/anomaly/validation), **age**, and **impact/amount/risk class**. Firm mode adds cross-client prioritization (deadlines, at-risk clients).
- **Bulk-approve gating:** only **high-confidence, flag-free, validation-clean** items are bulk-eligible; everything with a warning, duplicate, anomaly, or low/medium confidence requires individual review.
- **Per-item surface:** original document + extracted fields (with confidence + validation badges) + the suggestion (with `why?`) + duplicate/anomaly banners + sticky approve/correct/reject — keyboard-first.
- **Routing on action:** approve → post (+ learning signal that the suggestion was right); correct → post corrected (+ strong learning signal); reject → no post (+ negative signal). Conflicts/exceptions route per the Rules Engine's exception handling.

## 10. AI Learning Loop

How the system gets better from use — **without training shared models on customer data**.

```
 suggestion ──presented──▶ human action (approve / correct / reject)
      ▲                              │
      │                              ▼
      │                      AIFeedback ⊕ (structured signal: what was
      │                      proposed, what was chosen, context)
      │                              │
      │                              ▼
 future ◀── CompanyLearningProfile / PostingRule candidates (per company,
 suggestions   per counterparty) ── tenant-isolated, versioned
```

- **Learning is preference/rule adaptation, not foundation-model training.** Corrections update **in-platform** structures — the `CompanyLearningProfile` and candidate `PostingRule`s — which then **inform retrieval and prompts** (and the deterministic specificity layer). Customer data is **not** used to fine-tune shared base models (vendor zero-retention/no-training terms). This is the privacy-safe design.
- **Signal strength:** an explicit correction is a stronger signal than a silent approval; repeated corrections promote a learned mapping to a higher-confidence rule.
- **Versioned & reversible:** learned rules are versioned (Rules Engine), so a posting always explains the learned state as-of its date, and a bad learned pattern can be rolled back forward.
- **Closed loop with evaluation:** acceptance/override rates feed monitoring (Section 27) and the eval harness (Section 21).

## 11. Company-Specific Learning

- **Scope:** a per-company learned profile capturing how *this* business codes expenses, recurring postings, typical VAT treatments, and naming/aliases.
- **Isolation:** **strictly within one `tenant_id`/`company_id`** — never shared, pooled, or visible across tenants (Section 25).
- **Use:** raises suggestion specificity and confidence for that company; reduces review load over time; surfaces "you usually do X" reasoning.
- **Lifecycle:** continuously updated, versioned snapshots; rebuildable from `AIFeedback`.

## 12. Counterparty-Specific Learning

- **Scope:** within a company, per-supplier/customer patterns — e.g. "Supplier X → account 602, standard 20%, this cost center."
- **Why separate:** counterparty is the strongest predictor of correct coding; modeling it explicitly yields the biggest accuracy gains and the clearest explanations.
- **Use:** the most specific learned layer in the Posting/Categorization engines; a new invoice from a known supplier is often auto-apply-eligible after a few confirmations.
- **Isolation:** inherits company/tenant isolation; counterparty patterns never leak across companies even if the same supplier appears in many.

## 13. Confidence Scoring

- **Two distinct signals, never conflated:**
  - **Validated ✓ (deterministic):** the value passed a checkable rule (EIK checksum, VIES, IBAN, net+VAT=total). This is **fact**, shown without a percentage.
  - **Confidence % (probabilistic):** the model's calibrated certainty for things that aren't deterministically checkable (extraction reading, categorization, VAT classification).
- **Composition:** field confidence blends OCR/extraction model confidence, agreement across signals, and validation outcomes; suggestion confidence blends field confidence, rule specificity (deterministic match → higher), and learned-profile strength.
- **Tiers (per Design System):** **High ≥90% 🟢 · Medium 70–89% 🟠 · Low <70% 🔴**. Tiers drive review sort order, visual emphasis, and **auto-apply eligibility**.
- **Calibration:** confidence is **calibrated against actual acceptance/correction rates** (Section 21) so "90%" means roughly 90% correct in practice — overconfidence is a tracked defect.
- **Never on ledger facts:** figures sourced from the ledger carry no confidence — they're facts, not predictions.

## 14. Human-in-the-Loop Workflow

The non-negotiable control point (governed by the Rules Engine's **AI Override Rules**).

- **Default is review.** Proposals go to a human unless they clear the auto-apply bar.
- **Auto-apply is permitted only when ALL hold:** confidence = High, **risk class = low**, the company **opted in**, deterministic **validation clean**, **compliance clean**, and **no conflict/duplicate/anomaly**. Even auto-applied entries are **fully audited and reversible** (the human can undo).
- **Human always required for:** medium/low confidence, any flag (duplicate/anomaly/validation warning), novel counterparties, high amount/risk, irreconcilable conflicts, and **anything touching state** (NAP/KEP), period locks, or compliance vetoes.
- **AI can never:** approve a state submission, sign with KEP, lock a period, or override a constraint — by rule, regardless of confidence.
- **The human's action is itself a signal** (Section 10): approve/correct/reject all feed learning, and all are audited with the AI as the proposing actor and the human as the deciding actor.

---

## 15. AI Accountant Chat

- **Purpose:** grounded, transactional Q&A — VAT/accounting/compliance questions, explanations of entries and obligations, "how much VAT do I owe?", "why was this coded to 601?"
- **Architecture:** **LLM + RAG** over two corpora — (a) the **company's own ledger/documents** (scoped to the user's permissions) and (b) the **Bulgarian tax knowledge base** (Section 18). The model retrieves, then answers **with citations** in the user's language (BG/EN).
- **Grounding rules:** **figures come only from the ledger/projections** (retrieved, cited), never generated; rule/obligation claims cite the KB; if the answer isn't supported, the assistant says so and defers.
- **Action boundary:** can **deep-link** into the app ("Open VAT return") and **draft** a suggested treatment, but **cannot file, sign, approve, or post**. A persistent guidance disclaimer frames output as advisory.
- **Context awareness:** knows the current screen/period for relevant answers (e.g. opened from the VAT return).
- **Output contract:** answer + source citations (company data + tax rules) + suggested-action chips + guidance note (UX: SCR-AI-01).

## 16. AI CFO Chat

- **Purpose:** forward-looking financial advisory — cash-flow outlook, profitability, runway, cost drivers, "what if revenue drops 15%?"
- **Architecture:** **LLM narration over quantitative engines** — statistical/ML **forecasting** on the company's ledger history and projections (receivables/payables, seasonality), plus scenario computation; the LLM **explains and frames**, it does not invent the numbers.
- **Estimates are labeled.** Projections are clearly marked as estimates **with assumptions shown**; the assistant never presents a forecast as certainty and adds a not-financial-advice framing for regulated-advice territory.
- **Grounding & citations:** insights cite the underlying ledger/report data (drill-down); scenarios show their inputs.
- **Boundary:** advisory only; like the AI Accountant, it cannot transact. Available to owners/seniors/firm principals, not by default to client-portal users.

## 17. RAG Architecture

Retrieval-Augmented Generation underpins both chat assistants and grounded explanations.

```
 question ──▶ ① retrieve (tenant-scoped)
                 ├─ Company corpus: ledger facts, documents, entries (RLS-scoped)
                 └─ Tax KB corpus: ЗДДС/CITA/NSS/NRA guidance (shared, read-only)
             ──▶ ② rank & assemble grounded context (with source refs)
             ──▶ ③ generate answer constrained to the retrieved context
             ──▶ ④ attach citations (each claim → its source); abstain if unsupported
```

- **Per-tenant retrieval isolation.** The company corpus is retrieved **only within the asking tenant/company** (vector store partitioned by `tenant_id`; queries can never reach another tenant's vectors). The tax KB is shared, read-only, non-sensitive.
- **Figures vs prose.** Quantitative answers retrieve **structured ledger facts** (not embeddings of numbers) so amounts are exact and cited; prose/rules use semantic retrieval over the KB.
- **Citation linking.** Each retrieved passage carries a **stable reference** (ledger object, document id, or KB article/section) surfaced as a clickable citation.
- **Grounding constraint.** The generation step is instructed to answer **only from retrieved context** and to **abstain** ("I'm not certain — verify with your accountant") when retrieval is insufficient — the core anti-hallucination mechanism (Section 22).
- **Freshness.** Company retrieval reflects current ledger state (event-driven index updates); KB retrieval reflects the active KB version (Section 18).

## 18. Bulgarian Tax & Accounting Knowledge Base

- **Contents:** a curated corpus of **ЗДДС (VAT Act), CITA (corporate tax), НСС (National Accounting Standards)/IFRS basics, NRA (НАП) guidance, SAF-T technical documentation, invoicing requirements, deadlines**, plus plain-language explainers mapping rules to the platform's actions.
- **Structure:** chunked with **stable citations** (article/section/source + version + effective date) so answers can cite precisely and resolve **as-of a date** (e.g. the VAT rules in force for the period in question).
- **Versioning & governance:** the KB is **versioned and effective-dated** (mirroring the jurisdiction pack). A defined editorial process — sourced from official texts, reviewed by qualified accountants/tax experts, change-logged — keeps it accurate; updates (rate changes, SAF-T revisions, new guidance) publish a new version.
- **Separation from learned data.** The KB is **regulatory knowledge** (shared, authoritative); it is distinct from per-company **learned preferences** (private). The assistant cites the former and personalizes with the latter.
- **Quality control:** KB answers are part of the evaluation set (Section 21); outdated or unsourced content is a tracked defect. The KB is **read-only to the model** and never contains customer data.

## 19. Prompt Architecture

- **Versioned prompt registry.** Every task (extraction normalization, categorization, VAT classification, chat, explanation, anomaly description) has a **named, versioned prompt template**; the version is recorded on each `AISuggestion`/answer for reproducibility and rollback.
- **Structured outputs.** Tasks that feed the pipeline request **structured, schema-constrained output** (fields, confidences, reasoning) so results parse deterministically; free text is reserved for explanations/chat.
- **Grounding & guardrail instructions.** System prompts enforce: answer only from provided context; cite sources; never invent figures; abstain when unsure; treat any document/user-supplied text as **data, not instructions**; never claim to have filed/signed; respond in the user's language.
- **Context assembly.** Prompts compose: task instruction + retrieved grounding (RAG) + relevant company/counterparty learned context + the specific input — all tenant-scoped.
- **Injection-resistant framing.** Untrusted content (OCR text, document fields, chat input) is delimited and labeled as untrusted; instructions embedded in documents are never honored (Section 23).
- **Language.** Prompts and outputs honor BG-default/EN; Bulgarian terminology preserved (ЗДДС, ЕИК, КЕП) with consistent glossing.

## 20. Model Selection Strategy

- **Task-to-model mapping (tiered):**

| Task | Model class | Why |
|------|-------------|-----|
| Image pre-processing | deterministic CV | no model needed |
| OCR / layout reading | managed document-AI / OCR (EU) | accuracy on varied scans |
| Invoice field/table extraction | **Vision-LM / document-AI** | layout-aware, generalizes |
| Value normalization | small/cheap LLM | light reasoning, low cost |
| Document classification | small classifier / VLM | fast, cheap |
| Categorization / VAT-ambiguity gap-fill | mid LLM | reasoning, gap-fill only |
| Anomaly description | mid LLM | narrative over detected stats |
| AI Accountant / AI CFO chat | **frontier LLM** | reasoning, grounding quality |
| Forecasting (CFO) | statistical/ML | numeric, not LLM |
| Deterministic facts | **no model** (rules/validators) | correctness |

- **Vendor abstraction (model gateway):** swap/mix models per task and cost; **EU endpoints with zero-retention/no-training** terms; **self-hosted open models** for the most sensitive content or cost control.
- **Escalation:** cheap model first; **escalate to a stronger model only when** confidence is low or the task is complex (Section 26).
- **Pinned versions:** every output records its `ModelVersion`/`PromptVersion` for reproducibility, evaluation, and rollback.

## 21. Model Evaluation Strategy

- **Labeled evaluation sets:** representative Bulgarian documents (varied layouts, languages, quality) and accounting/VAT scenarios, with ground-truth fields, codings, and treatments — refreshed over time.
- **Metrics:** extraction field accuracy (per field), classification accuracy, **suggestion acceptance rate**, **correction/override rate**, **hallucination rate** (chat: unsupported claims), **confidence calibration** (predicted vs actual correctness), latency, and cost per document.
- **Regression gates:** a model/prompt change **must not regress** key metrics on the eval set before promotion; promotion is gated, versioned, and reversible.
- **Shadow & A/B:** new models run in **shadow** (scored against production decisions without affecting users) and/or controlled A/B before rollout.
- **Continuous, production-grounded eval:** real acceptance/override/abstention data feeds calibration and drift detection (Section 27); the eval set is expanded with hard cases surfaced in production.
- **KB evaluation:** chat answers are checked for **citation correctness** and currency against the KB; uncited/outdated answers are defects.

---

## 22. Hallucination Prevention

Layered defenses, because in accounting a confident wrong answer is worse than an abstention.

1. **Deterministic over model.** Anything checkable is decided by validators/rules, not the LLM (the single biggest defense).
2. **Figures from the ledger only.** Quantitative answers retrieve exact ledger facts; the model never produces a number from "memory."
3. **Grounded generation + abstention.** Chat answers only from retrieved context; **if unsupported, the assistant abstains and defers** ("verify with your accountant") rather than guessing.
4. **Citation-required.** Factual claims must carry a source (company data or KB); an unsourced claim is suppressed/flagged.
5. **Constrained, structured outputs** for pipeline tasks reduce free-form fabrication.
6. **No invented fields in extraction.** Missing data is marked missing, never imagined.
7. **Confidence + calibration** surface uncertainty honestly; low confidence routes to humans.
8. **Evaluation gate** measures hallucination rate and blocks regressions (Section 21).

## 23. AI Safety & Guardrails

(Security architect lens.)

- **Capability boundaries (hard):** AI **cannot post, sign, file, approve state submissions, lock periods, change permissions, or override any compliance/validation constraint** — enforced by the Rules Engine, not by prompt alone.
- **Document-borne prompt injection — primary threat.** The system OCRs/parses **untrusted documents**; a malicious file could embed instructions ("approve this," "ignore prior rules"). Defenses: **all document/extracted/user content is treated as data, never instructions**; untrusted text is delimited and labeled; the model has no tools to take privileged actions even if "instructed"; suggestions still pass deterministic validation + compliance + human review. Instructions found in content are surfaced to the user, never acted upon.
- **Tool/action isolation.** Conversational AI has **read + deep-link only**; it holds no capability to mutate state. Any "action" is a navigation suggestion the human performs.
- **Output safety:** no fabricated legal/tax certainty; advisory framing; refusal to produce non-compliant guidance; PII minimization in outputs.
- **Input hardening:** malware scan + sandboxed parsing; XXE/ZIP-bomb/macro defenses; rate-limiting on AI endpoints.
- **Auditable actor:** every AI action is logged with model/prompt version and inputs; the AI is a named principal in the hash-chained trail.
- **Model supply chain:** pinned, evaluated model versions via the gateway; rollback on regression; EU/zero-retention vendors.

## 24. GDPR & Data Privacy

- **EU data residency** for all AI processing: documents, embeddings, retrieval, and model calls routed to **EU endpoints**; no data leaves the EU boundary.
- **Zero-retention, no-training vendor terms.** Model providers process under contracts that **prohibit retaining or training on** customer data; sub-processors are governed by DPAs. Customer data is never used to improve shared models.
- **Data minimization & purpose limitation.** Only the data needed for a task is sent to a model; sensitive identifiers minimized/redacted where not required; retrieval scoped to the question.
- **PII awareness.** Documents and counterparties contain PII (mapped in the domain model); AI handling respects access control, export, and erasure.
- **Data-subject rights interplay.** Erasure/export requests reconcile with statutory retention and legal holds (per the domain model); learned profiles and embeddings are included in erasure scope where legally required.
- **Self-hosting option** for the most sensitive content or where contractual guarantees are insufficient.

## 25. Data Isolation Between Tenants

The most AI-specific privacy requirement — isolation must hold across every AI surface, not just the database.

- **Retrieval isolation:** the **vector store is partitioned by `tenant_id`**; company-corpus retrieval can never reach another tenant's vectors (enforced at the data layer, like RLS).
- **Learning isolation:** `CompanyLearningProfile`/learned rules are **strictly per company/tenant**; no cross-tenant pooling, no shared fine-tuning on customer data; the same supplier across two companies yields **separate** learned patterns.
- **Prompt/context isolation:** assembled context for any request contains **only the asking tenant's** data plus the shared (non-sensitive) KB.
- **Cache isolation:** AI caches (e.g. extraction results, embeddings) are keyed by tenant; no shared cache returns another tenant's content.
- **Model isolation:** stateless model calls carry no cross-tenant memory; zero-retention prevents the vendor from persisting one tenant's data into another's responses.
- **Verification:** isolation is part of the security test suite and monitoring (a cross-tenant retrieval is a sev-1 defect).

## 26. AI Cost Optimization

- **Native parse before OCR.** Structured inputs skip OCR/LLM entirely — the cheapest, most accurate path (Section 6).
- **Model tiering & escalation.** Cheap models for classification/normalization; escalate to frontier models **only** for low-confidence or complex reasoning/chat.
- **Confidence gating** reduces LLM calls: high-confidence deterministic matches don't need LLM gap-fill; auto-apply skips further model work.
- **Caching & dedup.** Extraction results cached by **content hash** (re-uploads/duplicates reuse results); embeddings cached; repeated KB retrievals cached.
- **Batching** of asynchronous extraction/embedding work.
- **Right-sized retrieval & context** (only needed passages) to control token cost.
- **Per-tenant metering** ties AI consumption to billing/entitlements (domain model `UsageMeter`), making cost visible and chargeable for heavy use.
- **Self-hosted models** for high-volume, lower-complexity tasks where unit economics favor it.

## 27. AI Monitoring & Observability

- **Quality dashboards:** extraction accuracy, acceptance/override/abstention rates, hallucination rate, confidence calibration — per model/prompt version and per document type.
- **Drift detection:** alerts when acceptance drops, override rises, or calibration degrades (model drift, new document patterns, regulatory change).
- **Operational metrics:** latency, throughput, queue depth (month-end spikes), error rates per stage, **cost per document / per tenant**.
- **Tracing:** every AI output traced end-to-end (inputs, model/prompt version, retrieval sources, confidence, decision) — for debugging and audit.
- **Production evaluation:** continuous scoring against ground truth and human decisions; hard cases captured into the eval set.
- **Security monitoring:** cross-tenant-retrieval guards, injection-attempt detection, anomalous-usage alerts.
- **Alerting & SLOs** on quality and availability; regressions page on-call and can trigger model rollback.

## 28. Failure Handling

Per-stage, graceful, never blocking capture or silently corrupting data.

| Failure | Handling |
|---------|----------|
| Image too poor to OCR | quality gate → re-shoot prompt; capture preserved |
| OCR/extraction fails | retry; if persistent → manual entry with the original shown; document kept |
| Field low confidence | flagged → human review (never auto-applied) |
| Validation fails (det.) | blocking → review with the precise fix; not posted |
| Duplicate/anomaly | flagged → human resolves; not auto-posted |
| LLM/model unavailable | suggestions queue; **deterministic rules + manual paths still work**; retry with backoff |
| Vendor outage (VIES/NRA/bank) | proceed-with-flag or retry per criticality; capture/processing not blocked |
| Conversational AI down | "Couldn't reach the assistant — your data is unaffected"; app fully usable |
| Irreconcilable conflict | both options surfaced to human; no auto-pick |

All failures are **idempotent-safe** (retries never double-post) and **observable** (logged/alerted). The pipeline degrades to "human does it" rather than failing the user.

## 29. Fallback Strategy

Layered fallbacks ensure the platform always functions, with the human as the ultimate backstop.

- **Reading:** native parse → document-AI/OCR → manual entry (with original displayed).
- **Models:** frontier → mid → cheap → self-hosted; chat degrades to KB-only or "ask your accountant."
- **Suggestions:** learned rule → deterministic default → AI gap-fill → suspense/holding + review.
- **Validation:** external check (VIES) → cached/last-known → manual mark with flag.
- **Automation:** auto-apply → human review (the safe default whenever any precondition fails).
- **Conversational:** grounded answer → "insufficient information, here's what I found, verify with your accountant" → defer.
- **Principle:** **every AI fallback ends in a safe, human-controllable state**; nothing is ever auto-committed because a fallback fired.

## 30. AI Roadmap

Aligned to the product phases.

- **MVP — assistive intelligence.** Document Intelligence (OCR/VLM extraction + deterministic validation), AI accounting/VAT **suggestions** with the learning loop, confidence scoring, the Review Queue, grounded **AI Accountant** chat (BG/EN) with citations, tenant isolation, EU/zero-retention. Conservative auto-apply (high-confidence routine purchases, opt-in). SAF-T-shaped extraction data.
- **Phase 2 — deeper automation & insight.** Stronger anomaly/risk detection and the **AI Recommendations Center**; higher (still gated) auto-apply coverage; **AI CFO** (forecasting + advisory); improved categorization; expanded KB; better calibration; firm-level cross-client intelligence.
- **Phase 3 — proactive & expansion.** Proactive compliance assistant (deadline/risk foresight), predictive tax planning, broader auto-apply within strict guardrails, **multi-jurisdiction** (new KB + jurisdiction pack proving the language/jurisdiction separation), and e-invoicing-era structured-data automation. **Throughout: human-in-the-loop for money/state remains non-negotiable; automation breadth grows only as calibrated trust is proven.**

---

## Explanations — the nine questions, answered directly

### A. Which AI tasks use OCR
OCR (raw text/layout reading) runs **only on the document path** — photographed or scanned images and image-only PDFs/TIFF. Tasks: reading text and layout from supplier invoices, receipts, and scanned bank statements. **OCR is not used** for XML/structured e-invoices (native parse) or for digital text-PDFs where embedded text is reliable. Modern **Vision-LM extraction** increasingly performs the read+extract together, but the trigger is the same: *pixels in, structure out.*

### B. Which AI tasks use LLM (incl. Vision-LM)
- **Vision-LM:** layout-aware invoice **field + line-item extraction** from documents.
- **LLM (reasoning):** value normalization, document **classification**, **categorization** gap-fill, **VAT-classification ambiguity**, **anomaly narration**, and **conversational chat** (AI Accountant, AI CFO) with grounded explanations.
- LLMs are used for **reading, classifying, reasoning, suggesting, and explaining** — never for facts that can be checked deterministically.

### C. Which tasks are deterministic-rules-only (no AI)
- **All validation:** EIK checksum, VAT-number format, **VIES**, **IBAN**, **net + VAT = total**, double-entry balance, numbering gaps, completeness.
- **VAT rate/treatment determination** (the VAT Rules Engine) and **posting selection** where a deterministic/learned rule matches.
- **Period control** (open/locked), **compliance constraints**, **currency conversion** at the fixed 1.95583 rate, depreciation/recognition **schedule math**, and **structured (XML) parsing**.
- Rule of thumb: *if it's checkable or legally fixed, it's deterministic, and determinism wins over any model.*

### D. Which tasks require human approval
- Any proposal **below high confidence**, or with a **flag** (duplicate, anomaly, validation warning), or a **novel counterparty**, or **high amount/risk class**, or an **irreconcilable conflict**.
- **Always, regardless of confidence:** posting to/locking a period's filing, **VAT return filing**, **KEP signing**, **NAP submission**, permission changes, and anything a **compliance constraint** governs.
- **Firm policy** can require preparer ≠ approver for state submissions.

### E. Which tasks may be auto-approved
Only when **every** condition holds: **High confidence (≥90%) + low risk class + company opted-in + deterministic validation clean + compliance clean + no duplicate/anomaly/conflict.** In practice: routine, recurring **purchase postings from known counterparties** with validated arithmetic. Auto-applied entries remain **fully audited and reversible**. **Never auto-approved:** anything touching the state (NAP/KEP), period locks, or compliance-vetoed outcomes.

### F. How the AI learns from corrections
Each human **approve / correct / reject** becomes a structured **`AIFeedback`** signal (proposed vs chosen + context). Feedback updates **in-platform, tenant-isolated** structures — the **`CompanyLearningProfile`** and candidate **`PostingRule`s**, scoped **per company and per counterparty** — which then raise the specificity/confidence of future suggestions (and feed prompts/retrieval). Corrections are stronger signals than silent approvals; repeated patterns get promoted to higher-confidence learned rules. Learned rules are **versioned and rollback-able**. Critically, **customer data is not used to fine-tune shared foundation models** — learning is preference/rule adaptation inside the tenant boundary.

### G. How the AI avoids hallucinations
Deterministic-over-model for anything checkable; **figures only from the ledger** (retrieved, never generated); **grounded generation with mandatory citations and abstention** when unsupported; **no invented fields** in extraction (missing = missing); structured/constrained outputs; honest **calibrated confidence** that routes uncertainty to humans; and an **evaluation gate** that measures and blocks hallucination regressions. (Section 22.)

### H. How the AI cites sources
RAG retrieves from (a) the **company's own ledger/documents** and (b) the **versioned Bulgarian tax KB**, each chunk carrying a **stable reference** (ledger object / document id / law article + version + effective date). Each factual claim in an answer links to its source as a **clickable citation**; quantitative claims cite the exact ledger figures; rule claims cite the KB passage **as-of the relevant date**. Unsourced factual claims are suppressed. (Sections 17–18.)

### I. How AI outputs are audited
Every **`AISuggestion`** is a persisted, immutable artifact recording **inputs, model + prompt version, retrieval sources, confidence, reasoning, and the `RuleTrace`** (deterministic-vs-AI provenance). Every human decision on it is logged as **`AIFeedback` + an `AuditEvent`**, with the **AI as a named non-human actor** and the human as the decider, in the **hash-chained, append-only audit trail**. Posted entries link back to the suggestion + rule trace, completing the lineage **document → extraction → suggestion → rules → posting**. Conversational answers log their retrieval sources. Any output can therefore be explained and reconstructed after the fact — for the user, an auditor, or the NRA.

### Summary matrix — task × engine × authority

| Task | OCR | Vision-LM | LLM | Deterministic | Auto-approve? | Human approval |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Read scanned doc | ✓ | ✓ | – | – | n/a | n/a |
| Parse XML e-invoice | – | – | – | ✓ | n/a | n/a |
| Extract fields/lines | – | ✓ | light | – | n/a | n/a |
| Validate EIK/VIES/IBAN/sum | – | – | – | ✓ | n/a | n/a |
| VAT rate/treatment | – | – | ambiguity only | ✓ | — | if flagged |
| Posting/account coding | – | – | gap-fill | ✓ (rules/learned) | if High+clean | otherwise |
| Expense categorization | – | – | ✓ | limits det. | if High+clean | otherwise |
| Anomaly/risk | – | – | narrate | ✓ (stats) | — | review |
| Chat (Accountant/CFO) | – | – | ✓ (RAG) | facts det. | n/a (advisory) | n/a |
| File VAT / sign KEP | – | – | – | ✓ (compliance) | **never** | **always** |

---

## Closing — how the AI architecture holds together

- **Four subsystems, one rule:** Document Intelligence reads, Accounting Automation suggests, Conversational AI advises, Learning & Quality improves them — and **none can commit**; the human and the deterministic rules hold the pen.
- **Determinism is the backbone:** validators and the rules engine decide everything checkable; the LLM/Vision-LM handle reading, judgment, and explanation, with confidence that's honestly calibrated.
- **Grounded and cited:** answers come from the company's ledger and a versioned Bulgarian tax KB, with citations and abstention — figures are never invented.
- **Isolated and private by construction:** retrieval, learning, embeddings, and caches are tenant-scoped; EU-resident, zero-retention processing; customer data never trains shared models.
- **Safe against the realistic threat:** untrusted document content is data, not instructions; the AI has no privileged actions to hijack; everything is audited with the AI as a named actor.
- **Economical and observable:** native-parse-first, model tiering, caching, and gating control cost; quality, drift, cost, and security are continuously monitored, evaluated, and rollback-able.
- **It grows only as trust is earned:** automation breadth expands phase by phase, but human-in-the-loop for money and the state is permanent.

Together with the six prior documents, this completes the platform's foundational architecture: capture → understand (AI) → propose (rules + AI) → human approve → record (immutable ledger) → comply (VAT/NAP/KEP/SAF-T) — intelligent, explainable, compliant, and safe by design.

*End of v1.0 AI Architecture.*
