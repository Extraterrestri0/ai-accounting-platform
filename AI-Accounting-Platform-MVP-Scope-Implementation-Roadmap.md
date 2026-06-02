# AI Accounting Platform — MVP Scope & Implementation Roadmap

**Document type:** MVP scope + execution roadmap (practical — no code)
**Builds on:** the ten architecture documents (v1.0)
**Acting as:** Senior Product Manager · CTO · Principal Software Architect · Startup Execution Advisor
**For:** a **2-person team building with Claude Code**, Bulgaria-first, token-conscious
**Status:** v1.0 — execution baseline

---

## Reality check (read this first)

The full vision is a 10-document platform. **You cannot and should not build that as an MVP.** With two people + Claude Code, the goal of the first 90 days is a **pilot-ready product for 3–5 friendly design partners** (small businesses + one or two accountants) that nails **one loop**:

> **upload a document → AI extracts the data → human reviews → approves → an immutable double-entry posting is created → basic VAT registers + reports come out.**

Everything else is either **cut**, **deferred to a phase**, or **manualized** (a human or a manual step stands in for software). The three things you must **never** compromise — because they can't be retrofitted safely — are **tenant isolation (RLS), the immutable double-entry ledger, and the audit trail**. Get those right from commit #1; fake almost everything else.

**Execution doctrine for two people:**
- **Buy, don't build** the hard ML (OCR/extraction = a vendor API). Build the accounting correctness yourself.
- **Vertical slices, not horizontal layers.** Ship one feature end-to-end (DB→backend→AI→frontend) before starting the next.
- **Manualize compliance.** No in-app NAP/KEP/SAF-T in MVP — generate files, the user files them on the NRA portal.
- **Concierge the edges.** Onboard the first customers by hand; you are the "automation" for anything not yet built.
- **Human-in-the-loop everything.** No AI auto-posting in MVP — it's simpler, safer, and the right trust model.

---

## 1. MVP Product Scope

**One sentence:** *A Bulgarian-first web app where a small business or accountant uploads supplier/sales documents, the AI extracts the data, a human reviews and approves, and the system produces correct immutable accounting entries plus VAT registers and basic reports — with the VAT files exportable for manual filing on the NRA portal.*

**Who it's for (MVP):** small businesses, freelancers, and **individual accountants managing a few clients** (multi-company supported, but no fancy firm cockpit). Bulgarian language. EUR-primary with BGN reference.

**The MVP promise:** *"Stop typing invoices into a ledger. Photograph or upload them, check the AI's work, and your books + VAT are ready."* That alone is a sellable wedge.

---

## 2. What IS Included in MVP

The minimum that makes the core loop real and trustworthy:

**Foundation (production-grade, non-negotiable)**
- Multi-tenant data model with **PostgreSQL Row-Level Security** (tenant + company scoping).
- **Immutable double-entry ledger** (corrections by reversal only) + **append-only audit trail**.
- Auth (email + password + MFA), EU hosting, encryption, encrypted backups, secrets in a vault.
- **Multi-company support + company switcher** (so an accountant can hold a few clients) — but minimal firm UI.

**Master data**
- Company setup (EIK lookup/validation, VAT status, fiscal calendar).
- Counterparties (suppliers/customers) with EIK + VAT/VIES validation.
- **Bulgarian national chart of accounts** (preloaded) + a simple VAT-code set (20/9/0/exempt/RC/intra-EU).

**The core loop**
- **Document upload** (PDF/JPG/PNG; ZIP/TIFF if cheap) → EU object storage (immutable) → processing.
- **AI extraction** via a managed OCR/Document-AI vendor (EU, zero-retention) → the invoice field set + line items + per-field confidence.
- **Deterministic validation:** EIK checksum, VAT/VIES, IBAN, net+VAT=total, duplicate detection.
- **Simple rules engine:** deterministic VAT treatment + posting suggestion (template + **per-counterparty learned mapping** + LLM gap-fill).
- **Review Queue** (the signature screen): document viewer + extracted fields + AI posting/VAT suggestion + confidence + duplicate flag → **human approves/corrects/rejects** (no auto-post).
- **Ledger posting** on approval (immutable, balanced, audited).

**Sales side (basic)**
- **Basic invoice issuance** (the "invoice" type only — no credit/debit/proforma yet): customer + lines + VAT + EUR/BGN totals + sequential numbering → posts + generates a PDF + email send. (Drives adoption and the sales-VAT side of the return.)

**VAT & reporting (basic, manual filing)**
- **Purchase & sales VAT registers** (дневник на покупки/продажби), derived from postings.
- **VAT return view** (справка-декларация) with the payable/refundable figure + a **VAT Validation Center** (block/warn).
- **Export** the VAT files (and a printable return) for the user to **upload to the NRA portal themselves** — *no in-app NAP submission, no in-app KEP*.
- **Basic reports:** trial balance, simple P&L, the VAT registers — viewable + export (PDF/XLSX).

**Language & money**
- **Bulgarian UI** (i18n-scaffolded so EN is a later flip); Cyrillic-correct; **EUR primary + BGN reference**.

**Ops baseline**
- One EU region, managed Postgres + object storage + Redis/queue, basic CI/CD, staging + prod, backups (restore-tested), basic monitoring/alerting, PII-free logs.

---

## 3. What is EXCLUDED from MVP

Cut hard. Each line below is a *later* phase, not now:

- ❌ **Direct NAP submission** (manual portal upload instead) — *explicitly excluded per constraints*.
- ❌ **SAF-T export** (data shaped for it; no UI/generation yet) — *explicitly excluded*.
- ❌ **In-app KEP signing** (user signs on the NRA portal) — heavy integration, deferred.
- ❌ **AI CFO / forecasting / recommendations center** — *explicitly excluded*.
- ❌ **AI auto-apply / auto-posting** — everything is human-reviewed in MVP.
- ❌ **AI Accountant chat** — defer to Phase 2 (extraction + suggestions are the MVP AI value).
- ❌ **Bank import & reconciliation** — defer (or a tiny manual CSV match late, only if time).
- ❌ **Client portal** — defer; clients email/send docs to the accountant who uploads.
- ❌ **Firm cockpit** (cross-client dashboard, work queue, team management, SoD policies) — just a company list + switcher in MVP.
- ❌ **Credit/debit notes, proforma** — invoice only in MVP.
- ❌ **Fixed assets, depreciation, revenue-recognition schedules, period-close automation** — manual/Phase 2.
- ❌ **Full rules engine** (12 sub-engines, fixed-asset/depreciation/recognition) — MVP has VAT + posting + validation only.
- ❌ **Email-in capture, advanced search, white-label, dark mode, English UI** — later.
- ❌ **Mobile native app / advanced PWA offline** — responsive web first; camera capture is a nice-to-have, not a blocker.
- ❌ **Anomaly/risk detection, the full learning loop** — capture corrections (store feedback) but keep "learning" to simple per-counterparty memory.

> Rule of thumb: if it isn't on the path of *upload → extract → review → approve → post → VAT/report*, it waits.

---

## 4. Phase 1 Build Plan (MVP — ~first 90 days)

**Goal:** the core loop, end-to-end, pilot-ready for 3–5 design partners; books + VAT come out correctly; files exported for manual NRA filing.

**Build as 6 vertical slices** (each is DB→backend→AI→frontend→test, shippable):

1. **Foundation & first light:** repo + CLAUDE.md + infra skeleton; multi-tenant DB + **RLS** + **immutable ledger + audit** primitives; auth + MFA; one company; "hello tenant" works.
2. **Capture → extract:** document upload → EU storage (immutable) → vendor OCR extraction → extracted fields visible (no posting yet).
3. **Master data:** counterparties (+EIK/VIES), Bulgarian chart of accounts, VAT codes; company setup.
4. **Review → post:** Review Queue + validation + simple rules (VAT + posting suggestion + per-counterparty memory) → **approve → immutable double-entry posting** + audit. *(This slice = the heart of the product.)*
5. **Sales + VAT:** basic invoice issuance (posts + PDF + email); purchase/sales VAT registers + VAT return view + validation + **export for manual filing**.
6. **Reports + multi-company + harden:** trial balance / P&L / VAT registers; company switcher; BG localization polish; security/backup/readiness; onboard pilots.

## 5. Phase 2 Build Plan (after MVP — ~months 4–9)

**Goal:** reduce manual work, deepen trust, serve accountants properly, and approach real compliance automation.

- **Bank import & reconciliation** (MT940/CAMT/CSV/XLSX + auto-match).
- **AI Accountant chat** (grounded Q&A + citations) and the **learning loop** maturation.
- **Gated AI auto-apply** (high-confidence, low-risk, opt-in) — only after calibration data exists.
- **Client portal** (clients upload/view) + **firm cockpit** (cross-client work queue, deadlines, team/roles).
- **Credit/debit notes + proforma**; richer reports + custom report builder.
- **KEP signing in-app** + **direct NAP submission** (Phase C of the NAP strategy).
- **SAF-T export** (activate as the obligation widens) + **English language**.
- **Notifications** (deadlines, items to review), email-in capture, anomaly/risk detection + Recommendations Center.

## 6. Phase 3 Build Plan (~months 9–18)

**Goal:** proactive intelligence and expansion.

- **AI CFO** (forecasting/advisory), proactive compliance assistant, predictive tax planning.
- **Fixed assets + depreciation + revenue recognition** (the remaining rules-engine sub-engines), period-close automation.
- **E-invoicing / real-time reporting** when Bulgaria mandates it (UBL/Peppol).
- **Multi-jurisdiction** (second country = new jurisdiction pack + locale, proving the language/jurisdiction split).
- **Scale-out infra** (service extraction of AI/Reporting/Compliance, OpenSearch, multi-region EU DR), ISO 27001 certification, marketplace/integrations.
ENDOFDOC
echo "part1 done"; wc -l /home/claude/mvp-roadmap.md
---

## 7. First 30 Days Plan — "Spine standing"

**Outcome:** the foundation is real, and you can **upload a document and see the AI's extracted fields** in the app. No posting yet, but the hard core (tenancy/RLS, ledger primitives, audit, auth, infra) exists.

| Wk | Focus | Concrete deliverables |
|----|-------|------------------------|
| 1 | Setup & decisions | Repo + **CLAUDE.md** (architecture decisions, conventions, the doc index); EU cloud accounts; managed Postgres + object storage + Redis + secrets provisioned (light IaC); CI skeleton; staging env. |
| 2 | Data core | Multi-tenant schema + **RLS policies** + connection-context discipline; **immutable ledger + double-entry + append-only audit** primitives; migrations; **RLS + ledger invariant tests** (build these now, they protect everything). |
| 3 | Auth & company | Auth + MFA + sessions; tenant/company context end-to-end; one company creation (EIK lookup); the App Shell (BG, Cyrillic, EUR/BGN) + nav skeleton. |
| 4 | Capture → extract slice | Document upload → EU object storage (immutable) → **OCR vendor integration (EU, zero-retention)** → extracted fields stored + shown in a basic document detail view. **First end-to-end vertical slice done.** |

**Definition of done @ day 30:** a logged-in user, in a company, uploads a supplier invoice and sees AI-extracted fields with confidence — on infrastructure that is EU-resident, tenant-isolated (RLS), and audited.

## 8. First 60 Days Plan — "Core loop closes"

**Outcome:** the **upload → extract → review → approve → immutable posting** loop works end-to-end, with correct VAT determination and the purchase register populating.

| Wk | Focus | Deliverables |
|----|-------|--------------|
| 5 | Master data | Counterparties (+EIK/VIES validation), Bulgarian chart of accounts (preloaded), VAT code set. |
| 6 | Rules (simple) | Deterministic **VAT determination** (20/9/0/exempt/RC/intra-EU); **posting suggestion** (template + per-counterparty memory + LLM gap-fill); **validation** (EIK/VIES/IBAN/sum/duplicate). |
| 7 | Review Queue | The signature screen: viewer + fields (confidence) + AI suggestion (+why) + duplicate flag; approve/correct/reject; corrections stored as feedback. |
| 8 | Ledger posting | Approval → **immutable double-entry posting** + audit + purchase VAT register entry; period model + open/lock basics. |

**Definition of done @ day 60:** an accountant uploads a batch of supplier invoices, reviews/approves them, and correct immutable entries + a purchase VAT register appear. This is the product's heart, working.

## 9. First 90 Days Plan — "Sellable wedge + VAT out"

**Outcome:** sales side + VAT return + reports + multi-company; **pilot-ready**; VAT files exportable for manual NRA filing.

| Wk | Focus | Deliverables |
|----|-------|--------------|
| 9 | Invoicing | Basic invoice issuance (lines, VAT, EUR/BGN, sequential numbering) → posts + PDF + email; sales VAT register populates. |
| 10 | VAT return | VAT period assembly + **VAT return view** + **Validation Center**; **export files** (registers + printable return) for manual NRA upload. |
| 11 | Reports + multi-company | Trial balance, simple P&L, VAT registers (view + export); **company switcher** for accountants; BG localization pass. |
| 12 | Harden + pilot | Security/backup/restore test/readiness checklist; bug-bash; **onboard 3–5 design partners** (concierge); collect feedback. |

**Definition of done @ day 90:** a design-partner accountant runs a full month for a client — captures docs, reviews, posts, issues invoices, produces a VAT return, and exports it to file on the NRA portal — on a secure, EU-resident, isolated, audited system.

> **Honesty note:** 90 days = a working, dogfoodable **pilot**, not a polished public launch. Public launch comes after pilot feedback + hardening.

---

## 10. Module Build Order

Build in dependency order, but always as vertical slices:

1. **Platform/Tenancy** (tenant/company, RLS context) →
2. **Identity** (auth/MFA/roles) →
3. **Ledger + Audit** (immutable postings, append-only trail) — *build the core invariants before anything writes to them* →
4. **MasterData** (counterparties, chart of accounts, VAT codes, company) →
5. **DocIntel** (upload, storage, OCR extraction, validation, suggestions, review items) →
6. **Rules (simple)** (VAT + posting + validation) →
7. **Invoicing** (issue → post) →
8. **Tax** (VAT registers + return + validation center + export) →
9. **Reporting** (trial balance, P&L, registers) →
10. **Notification (minimal)** + **multi-company UI** (switcher).

*(Audit/events are cross-cutting from step 3 onward; Compliance/NAP/KEP/SAF-T modules are Phase 2.)*

## 11. Database Build Order

1. **Tenancy core + RLS:** tenants, organizations, companies; **RLS policies + connection-context**; the bypass-role isolation.
2. **Identity:** users, memberships, company-assignments (roles), sessions.
3. **Ledger + Audit:** accounts (chart), accounting periods, **journal entries/lines (immutable)**, balances (projection), **audit events (append-only, hash-chained)**, domain-event outbox.
4. **MasterData:** counterparties, VAT codes (effective-dated), exchange rate (fixed BGN/EUR), products.
5. **DocIntel:** documents (+versions), extractions/fields, AI suggestions, AI feedback, review items.
6. **Invoicing:** sales documents, lines, numbering series, payments/receivables (basic).
7. **Tax:** VAT periods, VAT ledger entries, VAT return, validation issues.
8. **Reporting projections** (trial balance/registers/aging) as read models.

*Money as exact decimals; everything tenant/company-keyed; immutable tables write-once; partitioning can wait (low MVP volume) but design keys for it.*

## 12. Backend Build Order

1. **Tenant-context middleware + RLS session wiring** (every request/job sets `SET LOCAL` tenant/company; fail closed).
2. **Auth/authz** (sessions, MFA, RBAC/ABAC checks — UX hints + server enforcement).
3. **Ledger posting service** (balanced, immutable, audited) + **audit writer** + **outbox**.
4. **MasterData services** (+ EIK/VIES/IBAN validators).
5. **Upload service** (signed-URL direct-to-storage) + **document service** + **malware scan gate**.
6. **OCR/AI worker** (queue, EU vendor, extraction → suggestion; capability-limited identity, *no* posting permission).
7. **Rules service** (VAT + posting + validation) → **review-item creation**.
8. **Approval → posting** flow (the human path that calls the posting service).
9. **Invoicing service** (numbering, issue, post, PDF, email worker).
10. **VAT service** (register assembly, return, validation, export) + **report generation** (workers).

## 13. Frontend Build Order

1. **App Shell** (top bar, nav rail, AI launcher placeholder, BG, Cyrillic, EUR/BGN) + auth/onboarding screens.
2. **Design-system primitives + tokens** (buttons, inputs, MoneyField, ConfidenceBadge, StatusChip, table, FormField) — build the few you need, not all 60.
3. **Document upload + detail** (dropzone, viewer, extracted fields).
4. **Review Queue** (list + single-item work surface) — *invest here; it's the signature screen*.
5. **Master data screens** (counterparties, chart of accounts, company settings).
6. **Invoice builder** (invoice type only) + invoice list.
7. **Accounting views** (journal/ledger/trial balance — data grids + drill-down) + **VAT** (registers/return/validation/export).
8. **Reports** + **company switcher** + dashboard (basic KPI tiles + to-dos).

*Use TanStack Query for server state, RHF+Zod for forms, build only the components the MVP screens need, Storybook lightly.*

## 14. AI / OCR Build Order

1. **Choose a managed OCR/Document-AI vendor** (EU region, zero-retention) — **do not build OCR**. Validate accuracy on real Bulgarian invoices first (a half-day spike before committing).
2. **Extraction worker:** call the vendor → map to the field set + line items → **per-field confidence** + bounding boxes (for highlight).
3. **Native XML parse** path (skip OCR for structured e-invoices) — cheap accuracy/cost win.
4. **Deterministic validators** (EIK/VIES/IBAN/arithmetic/duplicate) — trusted over the model.
5. **Suggestion logic:** VAT determination (deterministic) + posting (template + **per-counterparty learned mapping**) + **LLM gap-fill** for novel cases (cheap model first).
6. **Feedback capture:** store every approve/correct/reject as a signal (the seed of the learning loop) — but keep "learning" to simple per-counterparty memory in MVP.
7. **Tenant isolation + zero-retention + EU egress** enforced for all AI calls; everything traced (model/prompt version) for audit.

*No auto-posting, no chat, no CFO, no anomaly detection in MVP — extraction + suggestion only.*

---

## 15. Testing Plan (MVP-appropriate — test what can hurt you)

Don't build the full pyramid; test the things that cause **money errors, data leaks, or compliance failures**:

- **Ledger invariants (must-have, property-based):** every posting balances (Σdr=Σcr); postings are immutable; reversals fully offset. Generate random valid scenarios and assert invariants. *Build these in week 2 and never let them break.*
- **Tenant isolation (must-have):** automated tests that **no query/endpoint/job can cross `tenant_id`** with RLS active, including forged-tenant attempts. **Release-blocking.**
- **VAT correctness (golden cases):** a fixed set of Bulgarian scenarios (standard/reduced/RC/intra-EU/exempt) with expected treatments + amounts → assert the rules engine matches.
- **Extraction accuracy (manual eval):** a labeled sample of ~50–100 real Bulgarian invoices; track field accuracy; re-run when you change vendor/prompt. (Manual scoring is fine at MVP.)
- **Core-loop e2e (Playwright):** upload → extract → review → approve → posting → VAT register, on desktop; one happy path + key failure paths.
- **Validation tests:** EIK/IBAN/VIES/duplicate behave correctly (incl. service-down fallbacks).
- **Security smoke:** authz on sensitive actions, signed-URL scoping, no secrets in code (CI secret scan), basic dependency scan.
- **Skip for MVP:** exhaustive unit coverage, visual regression on every component, load testing (volumes are low), full a11y audit (do a keyboard pass on the review queue).

*Have Claude Code generate tests alongside features — but you own the ledger/RLS/VAT test cases (review them carefully; these are your safety net).*

## 16. Deployment Plan (lean but real)

- **Cloud:** **AWS EU (Frankfurt)** per the infra doc — managed everything: Postgres (RLS, multi-AZ), object storage (object-lock), Redis/queue, KMS, Secrets Manager. Don't over-build infra for MVP.
- **Hosting:** containers on a **serverless-container platform** (Fargate-style) — app service + a couple of worker services (OCR/AI, reports). Scale-to-low off-peak.
- **IaC light:** Terraform/OpenTofu for the core resources (enough for reproducibility), not a sprawling platform.
- **CI/CD:** build → test (incl. RLS + ledger tests) → security scans → staging → manual approve → prod (blue/green). DB migrations as a gated step (expand/contract).
- **Environments:** dev (local + cloud) · **staging** (prod-like) · **production**. **No unmasked prod data anywhere else.**
- **Backups:** automated, encrypted, **restore-tested** before pilot launch.
- **Monitoring:** basic metrics + error tracking + queue-depth + uptime alerts + cost alerts; **PII-free structured logs**; the audit trail is separate.
- **Launch shape:** **private pilot** — invite 3–5 design partners; feature-flag anything half-built; you watch logs/dashboards closely.

## 17. Risk Reduction Plan

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **OCR accuracy too low on BG invoices** | Med-High | **Spike-test the vendor on real invoices in week 4 before committing**; keep human review (no auto-post); fall back to manual entry gracefully. |
| **Ledger/VAT correctness bugs** (money errors) | High impact | Property-based ledger tests + golden VAT cases from day 1; an accountant design partner validates output; deterministic-over-AI. |
| **Tenant data leak** | Catastrophic | RLS from commit #1 + isolation tests as a release gate; cross-tenant access = sev-1; AI workers have no privileged access. |
| **Scope creep (2 people)** | High | This doc is the contract; anything not on the core loop is a phase; one slice at a time; say no. |
| **Compliance overreach** (NAP/KEP/SAF-T) | High | **Manualize** — export files, user files on the NRA portal; no in-app filing/signing in MVP. |
| **Token/cost burn with Claude Code** | Med | CLAUDE.md + the architecture docs as durable context; small scoped tasks; vertical slices; don't re-litigate decisions; commit often (Section 20). |
| **Building features nobody wants** | Med | **Design partners from week 1**; concierge-onboard; ship the wedge (capture→books) and listen. |
| **Burnout / bus factor** | Med | Keep infra managed (less ops); document decisions in CLAUDE.md; automate tests; sustainable pace. |

## 18. What to FAKE / Manualize in MVP

The startup superpower — a human or a manual step stands in for unbuilt software:

- **NAP submission → manual:** generate the VAT files; the user uploads them on the NRA portal. (No integration.)
- **KEP signing → user's own:** they sign on the NRA portal with their own KEP. (No in-app KEP.)
- **SAF-T → none:** excluded; just keep the data SAF-T-shaped.
- **AI auto-posting → human review:** everything goes through the Review Queue. Simpler + safer.
- **AI learning → per-counterparty memory:** store corrections, reuse the last mapping for a supplier; no fancy training loop.
- **Onboarding → concierge:** you set up the first companies/clients by hand; white-glove the pilots.
- **Client portal → email:** clients email docs to the accountant, who uploads them.
- **Bank reconciliation → manual/none:** users reconcile mentally or you defer entirely.
- **Notifications → email or none:** a simple email reminder for VAT deadlines, or nothing yet.
- **Anomaly/risk, AI chat, CFO, reports-builder → cut:** not in MVP.
- **English UI → later:** BG only (but i18n-scaffolded).
- **Firm cockpit → company list + switcher:** no cross-client dashboards yet.

## 19. What MUST be Production-Grade from Day One

You cannot fake these — they're either impossible to retrofit safely or they destroy trust if wrong:

- ✅ **Tenant isolation (RLS)** — data leaks are existential; build it first, test it always.
- ✅ **Immutable double-entry ledger** — correctness + immutability are the entire point of an accounting system.
- ✅ **Append-only audit trail** — trust, liability, and (eventually) regulatory defensibility.
- ✅ **Money/VAT correctness** — decimals not floats; effective-dated VAT; EUR/BGN at the fixed rate. A wrong number is worse than a missing feature.
- ✅ **Security basics** — auth+MFA, encryption at rest/in transit, secrets in a vault, no secrets in code, EU residency.
- ✅ **Encrypted, restore-tested backups** — losing a client's books is unrecoverable trust loss.
- ✅ **Human-in-the-loop for postings** — never let the AI silently write the books.
- ✅ **EU + zero-retention AI** — non-negotiable for the data and the market.

*Everything else can be rough, manual, or absent. These cannot.*

## 20. Claude Code Prompt Sequence

How to drive Claude Code efficiently with two people. **Token-economy rules first, then the ordered prompts.**

### 20.1 Token-economy & workflow rules
- **Create `CLAUDE.md` first** — the durable context: the stack decisions (NestJS + Python workers + Next.js + Postgres/RLS), conventions, the non-negotiables (RLS, immutable ledger, audit, human-in-loop), and an **index pointing to the 10 architecture docs** (kept in the repo). Claude Code reads this every session — **so you never re-explain the architecture**.
- **Point at the doc, don't re-describe.** "Implement the Review Queue per Screen-Specs §SCR-REV-02 and Design-System §11" beats pasting requirements.
- **One scoped vertical slice per task.** Small, end-to-end, reviewable. Avoid mega-prompts that sprawl and burn tokens.
- **Lock the foundations early; don't churn them.** Re-deciding the data model/RLS later is the most expensive mistake.
- **Commit often; small PRs.** Keep the working tree clean so the agent reasons over a coherent state.
- **You own the safety-critical reviews** (ledger, RLS, VAT) — read that code, don't rubber-stamp.
- **Let Claude Code write tests** with each slice, but supply the ledger/RLS/VAT cases yourself.

### 20.2 Ordered prompt sequence (each is one scoped task)

1. *"Create the repo structure and `CLAUDE.md` capturing our stack, conventions, non-negotiables (RLS, immutable ledger, append-only audit, human-in-loop), and an index to the architecture docs in `/docs`."*
2. *"Set up the modular-monolith skeleton (NestJS modules per bounded context: Identity, Tenancy, MasterData, DocIntel, Ledger, Tax, Invoicing, Reporting, Audit, Notification) with empty module boundaries and the shared kernel (tenant context, money value object)."*
3. *"Define the database schema and migrations for tenancy + RLS (tenants, companies, users, memberships, company-assignments) per Domain-Model §18–19; implement RLS policies and the `SET LOCAL` per-request tenant-context wiring; generate RLS tenant-isolation tests."*
4. *"Implement the immutable double-entry ledger (accounts, periods, journal entries/lines) per Domain-Model §4–7 with the balance invariant and immutability (no update/delete; reversal only), plus the append-only hash-chained audit log per §17; generate property-based ledger-invariant tests."*
5. *"Implement auth (email+password+MFA) and the RBAC/ABAC checks per Backend §6–8; UI hints + server enforcement; sensitive actions audited."*
6. *"Build the App Shell + auth/onboarding screens in Next.js per UX §5 and Design-System §1–5: BG default, Cyrillic, EUR primary + BGN reference, the token system in Tailwind/CSS variables."*
7. *"Implement MasterData: company setup (EIK lookup/validate), counterparties (+VIES/EIK/IBAN validators), the preloaded Bulgarian chart of accounts, and the VAT-code set (effective-dated) per Domain-Model §5,§7,§8."*
8. *"Build document upload (signed-URL direct to EU object storage, immutable) + malware-scan gate + the document model/versions per Backend §9,§22 and Domain-Model §12."*
9. *"Implement the OCR/extraction Python worker calling the chosen EU/zero-retention Document-AI vendor → field set + line items + per-field confidence + bounding boxes, per AI §2–4; capability-limited identity (no posting permission); native XML parse path."*
10. *"Implement the simple rules service: deterministic VAT determination + posting suggestion (template + per-counterparty memory + LLM gap-fill) + validators, per Rules-Engine §1–2,§8(simple) and AI §7–8; output a proposal + trace."*
11. *"Build the Review Queue (list + single-item work surface) per Screen-Specs §SCR-REV-01/02 and Design-System §11: viewer + fields (confidence) + suggestion (+why) + duplicate flag; approve/correct/reject; store corrections as feedback."*
12. *"Implement the approval → immutable posting flow (human-initiated only) that calls the ledger posting service and writes the purchase VAT register entry + audit; enforce period state."*
13. *"Build basic invoice issuance (invoice type only) per Screen-Specs §SCR-INV-02: lines + VAT + EUR/BGN totals + gapless sequential numbering → post + generate PDF + email worker; populate the sales VAT register."*
14. *"Implement VAT: period assembly from postings → purchase/sales registers + VAT return view + Validation Center + file export (no NAP submission), per Domain-Model §8 and Screen-Specs §SCR-VAT-*."*
15. *"Build basic reports (trial balance, simple P&L, VAT registers) as projection-backed read models with export, per Backend §23."*
16. *"Add the company switcher + a minimal dashboard (KPI tiles + to-dos) + BG localization pass."*
17. *"Set up CI/CD (build → tests incl. RLS+ledger+VAT → security scans → staging → prod blue/green), light Terraform for the EU resources, encrypted backups, and basic monitoring/alerting + PII-redacted logging, per Infra §16–21."*
18. *"Write the core-loop Playwright e2e (upload → extract → review → approve → posting → VAT register) and the VAT golden-case + extraction-eval harness."*
19. *"Run the production-readiness checklist (Infra §31): confirm RLS, isolation tests, immutable ledger, object-lock, backups restore-tested, secrets, EU residency, PII-free logs — fix gaps before pilot."*
20. *"Hardening pass + feature-flag the unfinished edges; prep concierge onboarding for 3–5 design partners."*

*(Reorder within a slice as needed, but keep 3–4 — RLS, ledger, audit, auth — before anything writes data. Each prompt = a reviewable PR.)*

---

## Closing — the execution thesis

- **Ship one loop, not a platform.** Upload → extract → review → approve → immutable posting → basic VAT/reports. That loop, done trustworthily, is a sellable product for Bulgarian small businesses and accountants.
- **Three things are sacred from day one:** **RLS tenant isolation, the immutable double-entry ledger, and the audit trail.** Build and test them first; fake almost everything else.
- **Buy the ML, build the correctness.** OCR is a vendor; the accounting truth is yours.
- **Manualize compliance.** No in-app NAP/KEP/SAF-T — export files, file on the NRA portal. This single decision removes the heaviest integration work from the MVP.
- **Human-in-the-loop, always.** No AI auto-posting in MVP — simpler, safer, and the trust model your market needs.
- **Two people move fast by saying no.** This roadmap is your scope contract; Claude Code is your force-multiplier; CLAUDE.md + the ten architecture docs are its durable memory so you spend tokens building, not re-explaining.
- **90 days → a real pilot**, not a launch. Get it in front of 3–5 design partners, watch the books come out correctly, and let their feedback — not the full vision — drive what you build next.

You already have the full architecture (ten documents). This roadmap is the disciplined path from that vision to something **buildable, sellable, and safe** — and then, phase by phase, back toward the full platform.

*End of v1.0 MVP Scope & Implementation Roadmap.*
