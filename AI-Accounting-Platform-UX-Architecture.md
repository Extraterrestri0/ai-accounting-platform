# AI Accounting Platform — Complete UX Architecture & Screen Design

**Document type:** UX architecture & screen specification (design only — no code, schema, or APIs)
**Builds on:** *AI Accounting Platform — Master Architecture & Product Design (v1.0)*
**Audience:** UI/UX designers (Figma handoff), product, frontend
**Goal:** detailed enough that a designer can build every frame in Figma directly from this document
**Status:** v1.0 — UX baseline

---

## How to read this document

- **Screen IDs** (e.g. `SCR-DSH-01`) are stable references a designer can map 1:1 to Figma frames.
- **Wireframes** are ASCII layout sketches showing structure, hierarchy, and zoning — not pixel design. Apply the design system (Section 1) on top.
- Every screen is specified once in the **Screen Inventory (Section 5)** with its nine required attributes (purpose, actions, goals, widgets, tables, buttons, filters, empty state, error state); the **deep-dive sections (6–13)** add wireframes and interaction detail for the most important areas.
- Throughout, **BG = Bulgarian (default), EN = English**. All labels below are shown in EN for readability; every string is localized.
- **Currency rule:** base = EUR; **BGN shown in a secondary reference position until 8 Aug 2026** (dual display), then switchable off by config.

---

## 1. Design Principles & UX Foundations

### 1.1 The seven UX principles

1. **Capture-first.** The shortest possible path from "I have a document" to "it's handled." A global `+ Capture` is reachable from every screen; mobile photo capture and email-in are first-class.
2. **Review, don't re-enter.** The default interaction is *confirm or correct* an AI proposal, not type from scratch. The Review Queue is a primary destination.
3. **Explain everything.** Every AI output carries a **confidence badge**, a **"why" affordance**, and a **link to the source document**. Numbers always trace to a source.
4. **Human holds the pen on money & the state.** Nothing is filed to NAP or signed without explicit human approval + KEP. These actions use a distinct, deliberate "commit" visual treatment.
5. **Two minds, one core.** Self-serve owners/freelancers see plain language and guided flows; accountants can expand the same object into full ledger depth (progressive disclosure).
6. **Calm, banking-grade trust.** Generous whitespace, restrained color, tabular financial figures, no clutter. Red/amber reserved strictly for risk, errors, and deadlines.
7. **Deadline-aware.** Compliance dates (VAT 14th, etc.) surface as badges, calendar items, and proactive nudges — never a surprise.

### 1.2 Visual foundations (for Figma setup)

| Token group | Definition |
|-------------|------------|
| **Color — base** | White `#FFFFFF` surface, off-white `#F6F8FB` app background |
| **Color — primary** | Light blue scale (trust/primary actions, links, selected states) |
| **Color — success** | Green scale (confirmed, reconciled, posted, paid) |
| **Color — warning** | Amber (needs attention, low confidence, due soon) |
| **Color — danger** | Red (errors, overdue, rejected, validation failures) |
| **Color — neutral** | Gray scale for text, borders, dividers, disabled |
| **Typography** | Clean sans-serif with full **Cyrillic + Latin** coverage; tabular figures for all amounts; type scale: Display / H1 / H2 / H3 / Body / Body-sm / Caption |
| **Spacing** | 4px base grid (4/8/12/16/24/32/48/64) |
| **Radius** | Small (inputs/badges) / Medium (cards) / Large (modals) |
| **Elevation** | 3 levels: flat (tables), raised (cards), overlay (modals/menus) |
| **Layout grid** | 12-column desktop; left nav rail + content; max content width for readability |

### 1.3 Global UI furniture (present on every authenticated screen)

```
┌────────────────────────────────────────────────────────────────────┐
│  TOP BAR                                                             │
│  [☰] Logo   [Company switcher ▾]   [🔍 global search]                │
│                          [+ Capture] [🔔 N] [🌐 BG|EN] [👤 Account ▾] │
├──────────┬─────────────────────────────────────────────────────────┤
│ LEFT NAV │  PAGE CONTENT                                            │
│ (rail)   │  ── breadcrumb / page title / primary page actions ──    │
│          │                                                          │
│          │                                                          │
│          │                                                          │
└──────────┴─────────────────────────────────────────────────────────┘
                            [ AI Accountant ● ]  ← persistent launcher
```

- **Top bar:** logo/menu, **company switcher** (firm mode), global search, `+ Capture`, notifications bell with count, **language toggle BG|EN**, account/profile menu.
- **Left nav rail:** module navigation (collapsible to icons). Badges show counts (e.g. items to review, deadlines).
- **AI Accountant launcher:** a persistent floating button (bottom-right) opening the assistant in a side panel, context-aware of the current screen.
- **Currency chip** (until Aug 2026): a small persistent indicator and per-figure secondary BGN reference.

### 1.4 Universal states (apply to every screen)

- **Loading:** skeleton placeholders (never spinners on full pages); content streams in progressively.
- **Empty:** purposeful empty states with an illustration, one-line explanation, and the single best next action.
- **Error:** inline field errors + a non-destructive page-level banner; errors say what happened and how to fix it; never lose user input.
- **Permission-denied:** graceful "you don't have access" with who to ask, never a dead end.
- **Offline/queued:** capture and drafts queue locally and sync; a status chip communicates sync state.

---

## 2. Information Architecture & Complete Sitemap

### 2.1 Three shells

The product has three top-level experiences that share components but differ in IA:

- **Firm Shell** — multi-company cockpit for accounting firms / accountants.
- **Company Workspace** — the single-company environment (used by owners/freelancers directly, and by accountants after drilling into a client).
- **Client Portal** — restricted surface for a firm's end clients.

### 2.2 Complete sitemap

```
PUBLIC / AUTH
├─ /                         Marketing/login entry
├─ /auth/login               Email + password
├─ /auth/mfa                 MFA challenge
├─ /auth/kep                 KEP (QES) login
├─ /auth/reset               Password reset
└─ /onboarding               First-run wizard (see Flow 4.x)
     ├─ /onboarding/profile
     ├─ /onboarding/company   (create / import / EIK lookup)
     ├─ /onboarding/vat        (VAT status, fiscal calendar)
     ├─ /onboarding/bank       (connect/import)
     ├─ /onboarding/kep        (KEP setup)
     └─ /onboarding/first-doc  (process first document)

FIRM SHELL  (/firm/…)
├─ /firm/dashboard           Firm KPIs, deadlines, cross-client work queue
├─ /firm/clients             Managed companies list + health/status
│   └─ /firm/clients/new      Add client company
├─ /firm/work-queue          Cross-company items needing attention
├─ /firm/deadlines           Firm-wide compliance calendar
├─ /firm/reports             Aggregated firm reporting
├─ /firm/team                Users, roles, per-company assignments
│   └─ /firm/team/{userId}
├─ /firm/billing             Subscription, usage, invoices
└─ /firm/settings            Firm profile, branding, data residency

COMPANY WORKSPACE  (/c/{companyId}/…)
├─ /dashboard                Company overview
├─ /documents                Document list/archive
│   ├─ /documents/upload      Upload Center
│   ├─ /documents/inbox       Email-in & unsorted
│   └─ /documents/{docId}     Document detail (original + extraction + lineage)
├─ /review                   AI Review Queue  ← core screen
│   └─ /review/{itemId}        Single-item review
├─ /sales
│   ├─ /sales/invoices        + /new, /{id}
│   ├─ /sales/credit-notes    + /new, /{id}
│   ├─ /sales/debit-notes     + /new, /{id}
│   ├─ /sales/proforma        + /new, /{id}
│   ├─ /sales/catalogue       Products/services
│   └─ /sales/customers       + /{id}
├─ /purchases
│   ├─ /purchases/expenses    + /{id}
│   └─ /purchases/suppliers   + /{id}
├─ /banking
│   ├─ /banking/import        Import statement (MT940/CAMT/CSV/XLSX)
│   ├─ /banking/reconciliation Reconcile workspace
│   └─ /banking/accounts       Bank accounts
├─ /accounting
│   ├─ /accounting/journal     Journal entries
│   ├─ /accounting/ledger      General ledger
│   ├─ /accounting/trial-balance
│   └─ /accounting/chart-of-accounts
├─ /vat
│   ├─ /vat/purchase-ledger
│   ├─ /vat/sales-ledger
│   ├─ /vat/returns           + /{periodId} (prepare/review/file)
│   └─ /vat/vies
├─ /compliance
│   ├─ /compliance            Compliance dashboard
│   ├─ /compliance/nap        NAP submissions
│   ├─ /compliance/saf-t      SAF-T exports (Phase 2)
│   └─ /compliance/kep        KEP signing center
├─ /receivables-payables     Aging, status
├─ /reports                  Report library + viewer
├─ /ai-accountant            Full-page assistant (also a side panel everywhere)
├─ /audit-trail              Activity history
└─ /settings
    ├─ /settings/company
    ├─ /settings/users
    ├─ /settings/integrations
    ├─ /settings/kep
    ├─ /settings/language
    └─ /settings/retention

CLIENT PORTAL  (/portal/{companyId}/…)
├─ /portal/dashboard         Simple status + to-dos
├─ /portal/upload            Send documents
├─ /portal/reports           View shared reports
├─ /portal/archive           Browse own documents
└─ /portal/notifications

ADMIN  (/admin/…)
├─ /admin/tenant
├─ /admin/subscription
├─ /admin/entitlements
└─ /admin/data-residency
```

### 2.3 IA principles

- **Depth ≤ 3 taps** to any core action from the dashboard.
- **Capture and Review are always one tap** (top bar + nav badge).
- The **company switcher** preserves the current module when jumping between clients (an accountant reviewing VAT for Client A lands on VAT for Client B).
- Compliance lives in its own branch so deadlines and submissions are never buried inside accounting.

---

## 3. Navigation Architecture

### 3.1 Navigation model per shell

| Shell | Primary nav | Entry context |
|-------|-------------|---------------|
| **Firm** | Dashboard · Clients · Work Queue · Deadlines · Reports · Team · Billing · Settings | Firm principal/staff logs in here; picks a client to enter the Company Workspace |
| **Company Workspace** | Dashboard · Documents · Review · Sales · Purchases · Banking · Accounting · VAT · Compliance · Receivables/Payables · Reports · AI Accountant · Audit · Settings | Owners/freelancers default here; accountants arrive via a client |
| **Client Portal** | Dashboard · Upload · Reports · Archive · Notifications | The firm's end client; minimal, friendly |

### 3.2 Left nav rail (Company Workspace) — grouping

```
DASHBOARD
─ CAPTURE & REVIEW
   Documents            (badge: unsorted N)
   Review Queue         (badge: to review N)
─ SALES
   Invoices · Notes · Proforma · Catalogue · Customers
─ PURCHASES
   Expenses · Suppliers
─ MONEY
   Banking              (badge: unreconciled N)
   Receivables/Payables (badge: overdue N)
─ ACCOUNTING
   Journal · Ledger · Trial Balance · Chart of Accounts
─ COMPLIANCE
   VAT                  (badge: period due)
   Compliance / NAP / SAF-T / KEP
─ INSIGHT
   Reports
   AI Accountant
   Audit Trail
─ SETTINGS
```

Rail collapses to icons; group headers persist as section dividers. Badges are amber for "attention" and red for "overdue/error."

### 3.3 Navigation patterns

- **Breadcrumb** on every inner page: `Company ▸ Module ▸ Object`.
- **Contextual page actions** top-right of content (e.g. `+ New invoice`, `Import`, `Export`).
- **Tabs** for sub-views within a module (e.g. VAT: Purchase ledger | Sales ledger | Return | VIES).
- **Right-side detail panel** pattern: lists open detail in a slide-over panel (keeps list context) with an option to expand full-page.
- **Command palette** (`Ctrl/Cmd-K`): jump to any company, screen, document, or customer; power-user path for accountants.
- **Sticky action bar** at the bottom of forms/workflows for primary commit actions (Save, Approve, File, Sign).

### 3.4 Notifications & deadlines

- Bell opens a **notification center** grouped by company (firm mode), type, and urgency.
- A **deadline strip** can appear at the top of dashboards near due dates (e.g. "VAT return due in 3 days").

---

## 4. User Flows (by persona)

Each flow lists the persona's goal, the path, decision points, and the key screens (with IDs from Section 5).

### 4.0 Persona snapshot

| Persona | Mindset | Top jobs | Sophistication |
|---------|---------|----------|----------------|
| **Small business owner** | "Keep me compliant without learning accounting" | Capture expenses, send invoices, know what they owe | Low–medium |
| **Freelancer / self-employed** | "Fast, mobile, minimal" | Photograph receipts, simple invoices, VAT done | Low |
| **Accountant** | "Process many clients efficiently, no errors" | Review AI output, post, prepare & file returns | High |
| **Accounting firm (principal/admin)** | "See risk across the practice, manage the team" | Oversee clients, deadlines, assignments, approvals | High |
| **Client portal user** | "Send my stuff, see my reports" | Upload documents, view reports | Very low |

### 4.1 Small business owner — core loop

Goal: stay on top of expenses, invoicing, and VAT with minimal effort.

```
Login → MFA → [SCR-DSH-01 Company Dashboard]
   │
   ├─ Capture expense:  + Capture → photo/upload → [auto-process]
   │     → notification "1 item ready to review" → [SCR-REV-01 Review Queue]
   │     → confirm AI suggestion (1 tap) → posted ✔
   │
   ├─ Send invoice:  Sales ▸ + New invoice → [SCR-INV-02] → pick customer →
   │     add catalogue items → review dual EUR/BGN totals → Issue & Email ✔
   │
   └─ Check position:  Dashboard cards → "VAT this period: €X" →
         tap → [SCR-VAT-03 VAT Return] (read) → AI Accountant explains
```

Decision points: low-confidence extraction → owner corrects (feeds learning). Overdue receivable → dashboard nudge → send reminder.

### 4.2 Freelancer — mobile-first capture

Goal: handle everything from a phone in seconds.

```
Open mobile app → biometric unlock → [Mobile Home]
   │
   ├─ Snap receipt:  ⊕ → camera → auto-crop → upload → "processing"
   │     → push notif "ready" → swipe-to-approve in [Mobile Review]
   │
   ├─ Quick invoice:  ⊕ → New invoice → pick recent customer →
   │     1 line item → Issue → share via email/link
   │
   └─ Ask:  AI Accountant → "How much VAT do I owe this month?" →
         grounded answer with figure + source
```

### 4.3 Accountant — client processing

Goal: clear the day's work across assigned clients accurately.

```
Login → MFA → [SCR-FRM-01 Firm Dashboard]
   │
   ├─ [SCR-FRM-03 Work Queue] (cross-client) → filter "Awaiting review" →
   │     open item → [SCR-REV-01/02] → correct/approve in bulk → posted
   │
   ├─ Switch to Client A (company switcher) → /vat/returns/{period} →
   │     [SCR-VAT-03] prepare → validation passes → request approval / approve →
   │     [SCR-KEP-01] sign with KEP → [SCR-NAP-01] generate file → submit/assist
   │
   └─ [SCR-AUD-01 Audit Trail] to confirm traceability for liability
```

Decision points: validation errors block filing → fix in ledger → re-validate. Segregation-of-duties: preparer ≠ approver (firm policy).

### 4.4 Accounting firm (principal/admin) — oversight

Goal: manage risk, deadlines, and the team across the whole practice.

```
Login → [SCR-FRM-01 Firm Dashboard]
   │
   ├─ Scan KPIs: clients at risk, deadlines this week, items overdue
   ├─ [SCR-FRM-02 Clients] → sort by "health" → drill into at-risk client
   ├─ [SCR-FRM-05 Team] → assign staff to companies, set roles/SoD policy
   ├─ [SCR-FRM-04 Deadlines] → see all VAT/SAF-T due dates → assign owners
   └─ [SCR-FRM-06 Billing] → usage vs plan (document volume / seats)
```

### 4.5 Client portal user — send & view

Goal: send documents to the accountant and see results, with zero accounting knowledge.

```
Login (simple) → [SCR-PRT-01 Portal Dashboard]
   │
   ├─ "Send documents":  [SCR-PRT-02 Upload] → drag/drop or photo →
   │     confirmation "Received — your accountant will process these"
   │
   ├─ "What do you need from me?": to-do list of requested documents
   │
   └─ "My reports":  [SCR-PRT-03 Reports] → view shared PDF reports
```

### 4.6 Cross-persona flow — Document to posted entry (the core loop, detailed)

```
[Capture] upload/photo/email-in
   → virus scan + store original (immutable)
   → classify type (invoice/receipt/statement/contract)
   → OCR + extract fields (+ confidence per field)
   → validate (EIK, VAT/VIES, IBAN, net+VAT=total) + duplicate check
   → AI proposes journal entry + VAT treatment (+ reasoning)
   → lands in [SCR-REV-01 Review Queue]
        ├─ high confidence + opted-in → auto-post (still audited, reversible)
        └─ else → human confirm/correct  (correction → learning loop)
   → post to ledger + audit event
   → available for reconciliation & VAT
```

### 4.7 Cross-persona flow — VAT period close & file

```
/vat/returns/{period} → assemble from approved postings
   → validation panel (missing VAT, duplicates, anomalies)
   → AI Accountant summary "what this means + risks"
   → Preparer reviews → submits for approval
   → Approver approves
   → [SCR-KEP-01] KEP sign
   → [SCR-NAP-01] generate NAP-compliant files (+ VIES if needed)
   → submit (MVP: download + portal upload guidance; later: direct)
   → period LOCKED → confirmation archived → audit trail updated
```

---

## 5. Screen Inventory

Every screen, grouped by area. Each entry: **Purpose · User goals · Main actions · Widgets · Tables · Buttons · Filters · Empty state · Error state.** Deep-dive screens (dashboards, upload, review, invoicing, accounting, AI, NAP/KEP, mobile) get wireframes in Sections 6–13.

### 5.A Authentication & Onboarding

**SCR-AUTH-01 — Login**
- Purpose: authenticate. Goals: get in fast and safely.
- Actions: enter email/password; choose KEP login; reset password; switch language.
- Widgets: email field, password field, "remember device," language toggle, KEP-login button.
- Tables: none. Buttons: Log in, Log in with KEP, Forgot password.
- Filters: none. Empty: n/a.
- Error: invalid credentials (inline, non-specific for security), locked account, rate-limit notice.

**SCR-AUTH-02 — MFA Challenge**
- Purpose: second factor. Goals: confirm identity.
- Widgets: code input (auto-advance), method switcher, resend timer, trust-device checkbox.
- Buttons: Verify, Use another method. Error: wrong/expired code, too many attempts.

**SCR-AUTH-03 — KEP Login**
- Purpose: strong auth via qualified signature. Widgets: provider/method selector (token/cloud/mobile), status stepper.
- Buttons: Continue with KEP, Cancel. Error: certificate not found, expired, middleware missing (with help link).

**SCR-ONB-01…06 — Onboarding wizard** (profile → company → VAT → bank → KEP → first doc)
- Purpose: from zero to first processed document. Goals: prove value fast.
- Widgets: progress stepper, EIK lookup field (auto-fills company data), VAT-status selector, fiscal-calendar picker, skip/later links.
- Buttons: Continue, Back, Skip for now, Finish.
- Empty: each step explains why it matters. Error: EIK not found/invalid checksum, KEP setup failed (skippable).

### 5.B Firm Shell

**SCR-FRM-01 — Firm Dashboard** *(wireframe §6.3)*
- Purpose: practice-wide situational awareness. Goals: know what's at risk and due.
- Widgets: KPI tiles (clients, items to review, returns due, overdue), deadline calendar strip, risk feed, team workload, client-health list.
- Tables: at-risk clients (mini). Buttons: Go to work queue, Add client. Filters: period, assignee, status.
- Empty: "Add your first client." Error: data load failure banner with retry.

**SCR-FRM-02 — Clients**
- Purpose: manage all client companies. Goals: find & assess clients fast.
- Tables: clients (name, EIK, VAT status, period status, items to review, next deadline, health, assignee).
- Widgets: health indicator, search, saved views. Buttons: + Add client, Open, Bulk assign.
- Filters: status, health, assignee, VAT period, deadline window, tag, search.
- Empty: onboarding CTA. Error: row-level load error chips.

**SCR-FRM-03 — Work Queue (cross-company)** *(wireframe §8.x pattern)*
- Purpose: one list of everything needing action across clients. Goals: clear work efficiently.
- Tables: items (company, type, document, confidence, age, assignee, status). Bulk select.
- Widgets: confidence badges, age heat. Buttons: Approve, Assign, Open, Bulk approve.
- Filters: company, type (review/reconcile/return), confidence, age, assignee, status.
- Empty: "All caught up 🎉." Error: partial-load notice.

**SCR-FRM-04 — Deadlines** — practice compliance calendar; widgets: month/list calendar, deadline cards (VAT 14th, SAF-T cadence, annual); buttons: Assign owner, Open return; filters: type, company, owner, window. Empty: "No upcoming deadlines." Error: sync banner.

**SCR-FRM-05 — Team** — users & per-company role assignments; table: user × company × role; widgets: role matrix, SoD policy toggle; buttons: Invite, Edit roles, Remove; filters: role, company, status. Empty: invite teammates. Error: invite-failed inline.

**SCR-FRM-06 — Billing/Usage** — plan, seats, document-volume meter, invoices; widgets: usage gauges vs plan, overage forecast; buttons: Manage plan, Download invoice; filters: period. Empty: n/a. Error: payment-method warning.

**SCR-FRM-07 — Firm Settings** — profile, white-label branding (Phase 2), data residency; widgets: logo upload, color picker (within brand limits), residency selector. Error: invalid logo format.

### 5.C Company Workspace — Documents & Review

**SCR-DOC-01 — Document List / Archive**
- Purpose: find any document. Goals: locate, filter, audit.
- Tables: documents (thumbnail, type, counterparty, date, amount, status, source, confidence).
- Widgets: thumbnail grid/list toggle, status chips, source icon (upload/email/portal). Buttons: + Upload, Open, Export, Bulk tag.
- Filters: type, status, date range, counterparty, amount range, source, tag, full-text search.
- Empty: "No documents yet — upload or forward to your inbox address." Error: search-failed inline.

**SCR-DOC-02 — Upload Center** *(deep-dive §7)*

**SCR-DOC-03 — Document Inbox (email-in / unsorted)** — triage incoming; table of unprocessed items; buttons: Process, Merge, Discard; filters: source, date. Empty: "Inbox clear." Error: parse-failed flag per item.

**SCR-DOC-04 — Document Detail**
- Purpose: inspect one document end-to-end. Goals: verify extraction, see lineage, act.
- Layout: original viewer (left) | extracted fields + posting + lineage (right).
- Widgets: zoom/pan viewer, field list with confidence, linked entry, version history, audit snippet, duplicate warning. Tables: line items, version history.
- Buttons: Edit, Re-run AI, Post/approve, Mark duplicate, Download, Delete (guarded).
- Filters: none. Empty: n/a. Error: OCR failed (re-run), file unreadable, validation errors highlighted on fields.

**SCR-REV-01 — AI Review Queue** *(deep-dive §8)*
**SCR-REV-02 — Single-item Review** *(deep-dive §8)*

### 5.D Sales

**SCR-SAL-01 — Invoices List** — table (number, customer, date, due, amount EUR (BGN), status: draft/issued/paid/overdue); buttons: + New invoice, Send, Duplicate, Export; filters: status, customer, date, amount, paid/unpaid; widgets: status chips, aging hint. Empty: "Create your first invoice." Error: send-failed (email) inline.

**SCR-INV-02 — Invoice Builder** *(deep-dive §9)*
**SCR-INV-03 — Credit Note** *(deep-dive §9)*
**SCR-INV-04 — Debit Note** *(deep-dive §9)*
**SCR-INV-05 — Proforma** *(deep-dive §9)*

**SCR-SAL-06 — Catalogue (products/services)** — table (name, unit, price EUR, VAT rate, code); buttons: + Add item, Import, Edit; filters: type, VAT rate, search. Empty: "Add items to speed up invoicing." Error: duplicate code.

**SCR-SAL-07 — Customers** — table (name, EIK, VAT no., country, balance, status); widgets: VAT/VIES validation badge; buttons: + Add, Validate, Open; filters: country, VAT status, balance. Empty: add first customer. Error: VIES timeout (retry, allow manual).

**SCR-SAL-08 — Customer Detail** — profile + history (invoices, payments, documents) + balance; tabs: Overview / Invoices / Documents / Activity. Error: load per-tab.

### 5.E Purchases

**SCR-PUR-01 — Expenses List** — table (supplier, date, category, net/VAT/total, status, source doc); buttons: + Add expense, Import, Open; filters: supplier, category, date, VAT, status. Empty: "Forward bills to your inbox or upload." Error: inline.

**SCR-PUR-02 — Expense Detail** — like Document Detail with categorization + deductibility flag + AI suggestion. Error: validation on VAT deductibility.

**SCR-PUR-03 — Suppliers** — mirror of Customers (validation, balance, history).

### 5.F Banking

**SCR-BNK-01 — Bank Accounts** — table (bank, IBAN, currency, balance, last import); buttons: + Add account, Import, Connect (PSD2 Phase 2); filters: bank, currency. Empty: "Add a bank account to start reconciling." Error: connection error.

**SCR-BNK-02 — Import Statement** — file picker (MT940/CAMT.053/CSV/XLSX), format auto-detect, mapping preview for CSV/XLSX; buttons: Import, Map columns, Cancel; widgets: detected-format chip, preview table. Empty: drag-drop zone. Error: unsupported/garbled file, column-mapping required, duplicate-import warning.

**SCR-BNK-03 — Reconciliation Workspace** *(wireframe §10.x)*
- Purpose: match transactions to invoices/entries. Goals: reach "reconciled" fast.
- Layout: bank transactions (left) ↔ suggested matches (right).
- Widgets: auto-match confidence, partial-payment splitter, fee/FX handler, match/unmatch. Tables: transactions, candidate matches.
- Buttons: Accept match, Split, Create entry, Reconcile, Undo. Filters: matched/unmatched, date, amount, account.
- Empty: "Import a statement to begin." Error: ambiguous match needs choice; FX rounding flag.

### 5.G Accounting *(deep-dive §10)*

**SCR-ACC-01 — Journal** — table (date, entry no., description, debit/credit accounts, amount, source, status); buttons: + Manual entry, Open, Reverse; filters: date, account, status, source. Empty: "Entries appear as documents are posted." Error: unbalanced-entry block.

**SCR-ACC-02 — General Ledger** *(wireframe §10.2)*
**SCR-ACC-03 — Trial Balance** *(wireframe §10.3)*
**SCR-ACC-04 — Chart of Accounts** — tree (BG national CoA classes 1–7); buttons: Add/edit account, Map; filters: class, active. Empty: load default CoA. Error: cannot delete used account.

### 5.H VAT & Compliance *(deep-dive §10–12)*

**SCR-VAT-01 — Purchase Ledger** *(wireframe §10.4)*
**SCR-VAT-02 — Sales Ledger** *(similar)*
**SCR-VAT-03 — VAT Return (period)** *(deep-dive §12)*
**SCR-VAT-04 — VIES** — intra-EU listing; validation status per partner; export. Error: VIES service down.

**SCR-CMP-01 — Compliance Dashboard** *(deep-dive §12.4)*
**SCR-NAP-01 — NAP Submission** *(deep-dive §12.1)*
**SCR-SAF-01 — SAF-T Export (Phase 2)** — period selector, schema version, validation report, generate + KEP sign; table: validation issues. Empty: "Not in scope yet for this company" informational state. Error: schema-validation failures listed.
**SCR-KEP-01 — KEP Signing Center** *(deep-dive §12.2)*

### 5.I Insight

**SCR-RPT-01 — Reports Library** — cards by category (P&L, balance sheet, VAT, aging, custom); buttons: Open, Schedule, Export (PDF/XLSX); filters: category, period. Empty: n/a. Error: generation failed.
**SCR-RPT-02 — Report Viewer** *(wireframe §10.5)* — rendered report + period/compare controls + drill-down to source.
**SCR-AI-01 — AI Accountant (full page)** *(deep-dive §11)*
**SCR-AUD-01 — Audit Trail** — table (timestamp, actor (human/AI), action, object, before→after, reason); filters: actor, action, object, date; widgets: per-record history view, integrity badge. Empty: n/a. Error: load banner. (Read-only; export for auditors.)

### 5.J Settings

**SCR-SET-01 Company · SCR-SET-02 Users · SCR-SET-03 Integrations · SCR-SET-04 KEP · SCR-SET-05 Language · SCR-SET-06 Retention** — standard settings forms; widgets: forms with inline validation, connection cards (status: connected/error), language default + fallback, retention policy with legal note. Buttons: Save, Test connection, Disconnect (guarded). Error: invalid values inline; disconnect warns about dependent features.

### 5.K Client Portal *(deep-dive §6.6)*

**SCR-PRT-01 Dashboard · SCR-PRT-02 Upload · SCR-PRT-03 Reports · SCR-PRT-04 Archive · SCR-PRT-05 Notifications** — simplified, friendly, single-company-scoped versions of the above.

---

## 6. Dashboard Design

Four dashboards, each answering one question for its audience. All cards are action-oriented (every figure links to where you act) and deadline-aware.

### 6.1 Dashboard design rules
- **Top zone = urgency** (deadlines + what needs you). **Middle = money** (position, cash, VAT). **Bottom = activity/insight.**
- Every monetary value: **EUR primary, BGN secondary reference** (until Aug 2026).
- Each card has a clear title, the figure, a trend/▲▼ where relevant, and a tap target.
- AI-flagged risks surface as a dedicated feed, each with a "why" and a fix action.

### 6.2 Main (Company) Dashboard — SCR-DSH-01

Audience: owner / freelancer / accountant-in-company-context.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Company ▸ Dashboard                              Period: May 2026 ▾   │
│ ⏰ VAT return due in 3 days  ·  2 items need your approval   [Review] │  ← deadline strip
├───────────────┬───────────────┬───────────────┬─────────────────────┤
│ CASH POSITION │ RECEIVABLES   │ PAYABLES      │ VAT THIS PERIOD     │
│ € 24,310      │ € 8,120 ▲     │ € 3,540       │ payable € 1,260     │
│ (BGN ref)     │ 4 overdue     │ 1 due soon    │ due 14 Jun          │
│ [Banking]     │ [Receivables] │ [Payables]    │ [VAT return]        │
├───────────────┴───────────────┴───────────────┴─────────────────────┤
│ NEEDS YOUR ATTENTION                                                  │
│  • 2 documents to review (1 low confidence)            [Review →]     │
│  • 1 duplicate invoice warning                         [Resolve →]    │
│  • 4 unreconciled bank transactions                    [Reconcile →]  │
├───────────────────────────────────┬───────────────────────────────────┤
│ AI RISK FEED                       │ RECENT ACTIVITY                   │
│  ⚠ Unusual amount on Supplier X    │  ✓ Invoice #142 issued            │
│     invoice vs history  [Open]     │  ✓ 6 expenses posted (AI)         │
│  ⚠ VAT rate mismatch on doc #88    │  ✓ Statement imported             │
│     [Open]                         │  … [View audit trail]             │
└───────────────────────────────────┴───────────────────────────────────┘
            [ Ask AI Accountant about this month ▸ ]
```
- Empty state (new company): a setup checklist replaces cards ("Connect bank · Upload first document · Add a customer").
- Error: per-card error chip with retry; never blank the whole page.

### 6.3 Accountant Dashboard

The accountant's *personal* work view (vs. the firm-wide view). Audience: a staff accountant.

```
┌─────────────────────────────────────────────────────────────────────┐
│ My Work                                              This week ▾      │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ MY CLIENTS   │ TO REVIEW     │ RETURNS DUE   │ AWAITING MY APPROVAL   │
│ 38 assigned  │ 57 items      │ 6 this week   │ 4                      │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│ MY WORK QUEUE (cross-client)                         [Bulk approve]   │
│ ┌─────┬───────────┬──────────┬────────────┬──────────┬────────────┐  │
│ │ ☐   │ Client    │ Type     │ Item       │ Conf.    │ Age        │  │
│ ├─────┼───────────┼──────────┼────────────┼──────────┼────────────┤  │
│ │ ☐   │ Acme OOD  │ Review   │ Invoice #5 │ 96% 🟢   │ 2h         │  │
│ │ ☐   │ Beta EOOD │ Reconcile│ 3 txns     │  —       │ 1d         │  │
│ │ ☐   │ Gama Ltd  │ VAT      │ May return │  —       │ due 2d 🟠  │  │
│ └─────┴───────────┴──────────┴────────────┴──────────┴────────────┘  │
├─────────────────────────────────────────┬───────────────────────────┤
│ DEADLINES (mine)                         │ CLIENTS AT RISK            │
│  • Gama Ltd — VAT 14 Jun                 │  Delta — missing docs      │
│  • Acme — VAT 14 Jun                     │  Zeta — unreconciled high  │
└─────────────────────────────────────────┴───────────────────────────┘
```
- Bulk actions on the queue; confidence and age drive sort. Empty: "No items assigned — pick up from the firm queue."

### 6.4 Firm Dashboard — SCR-FRM-01

Audience: principal/admin. Practice-wide risk and capacity.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Firm Overview                                        June 2026 ▾      │
├────────────┬────────────┬────────────┬────────────┬─────────────────┤
│ CLIENTS    │ TO REVIEW  │ RETURNS DUE│ OVERDUE    │ DOC VOLUME       │
│ 142        │ 318        │ 41 (7d)    │ 12 ⚠       │ 8.2k / 10k plan  │
├────────────┴────────────┴────────────┴────────────┴─────────────────┤
│ COMPLIANCE DEADLINE CALENDAR (week)        [List] [Month]            │
│  Mon ▢▢   Tue ▣ 9 returns   Wed ▢   Thu ▣ 14th VAT (28)   Fri ▢      │
├──────────────────────────────────┬──────────────────────────────────┤
│ CLIENT HEALTH (at risk first)     │ TEAM WORKLOAD                     │
│ ┌──────────┬────────┬──────────┐  │  Ivan    ██████░░  78%            │
│ │ Client   │ Health │ Next due │  │  Maria   ████░░░░  52%            │
│ │ Delta OOD│ 🔴 risk│ 14 Jun   │  │  Petar   ███████░  86% ⚠         │
│ │ Zeta EOOD│ 🟠 warn│ 14 Jun   │  │  [Rebalance assignments]         │
│ │ Acme OOD │ 🟢 ok  │ 14 Jun   │  ├──────────────────────────────────┤
│ └──────────┴────────┴──────────┘  │ AI RISK (firm-wide)               │
│ [All clients →]                    │  • 3 clients: VAT anomalies       │
│                                    │  • 5 clients: missing documents   │
└────────────────────────────────────┴──────────────────────────────────┘
```
- Empty (new firm): "Add your first client" hero. Error: degraded-data banner; cards show last-known with stale flag.

### 6.5 Client Dashboard (portal) — SCR-PRT-01

Audience: the firm's end client. Friendly, jargon-free.

```
┌───────────────────────────────────────────────────────────┐
│  Hello, [Name] 👋        Your accountant: [Firm]            │
├───────────────────────────────────────────────────────────┤
│  ✅ You're all set for May — nothing needed right now.      │
│      (or)  📩 Your accountant needs 2 documents:            │
│            • April bank statement   [Upload]                │
│            • Fuel receipts          [Upload]                │
├───────────────────────────────────────────────────────────┤
│  [ ⊕ Send documents ]        [ 📄 View my reports ]         │
├───────────────────────────────────────────────────────────┤
│  RECENT                                                     │
│   • You sent 5 documents (2 Jun) — received ✓               │
│   • New report available: May summary  [View]               │
└───────────────────────────────────────────────────────────┘
```
- Empty: warm "Nothing to do — we'll let you know." Error: simple "Couldn't load, try again," no technical detail.

---

## 7. Upload Center UX (SCR-DOC-02)

### 7.1 The upload experience

```
┌─────────────────────────────────────────────────────────────┐
│ Upload documents                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │            ⬆  Drag & drop files here                      │ │
│ │            or  [Browse]   [📷 Take photo]                 │ │
│ │   Accepted: PDF, JPG, PNG, TIFF, XML, ZIP · up to NN MB   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Or forward bills to:  inbox-acme@app.bg   [Copy]            │
├─────────────────────────────────────────────────────────────┤
│ UPLOADING / PROCESSING                                       │
│ ┌───────┬───────────────┬───────────┬─────────────────────┐ │
│ │ thumb │ invoice.pdf   │ ▓▓▓▓░ 80% │ Scanning…           │ │
│ │ thumb │ receipts.zip  │ ✓ 12 files│ Extracting (7/12)   │ │
│ │ thumb │ photo.jpg     │ ✓         │ Ready to review ✔   │ │
│ └───────┴───────────────┴───────────┴─────────────────────┘ │
│                              [Go to Review Queue (3) →]      │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Per-format handling (what the user sees)

| Format | Experience & feedback |
|--------|----------------------|
| **PDF** | Thumbnail of page 1; multi-page badge; if it contains multiple invoices, AI offers "Split into N documents?" |
| **JPG / PNG** | Auto-crop + de-skew preview; "enhance" toggle for low-light photos; quality warning if too blurry to OCR (offer re-shoot) |
| **TIFF** | Same as image; multi-frame TIFF treated as multi-page (page navigator) |
| **XML** | Recognized as structured e-invoice → parsed natively (no OCR); shows "Structured invoice detected — fields read directly"; higher default confidence |
| **ZIP** | Auto-expands; shows contained file count and per-file progress; mixed types handled individually; nested unsupported files flagged and skipped with a note |

### 7.3 Stages & status chips
`Queued → Scanning (malware) → Reading (OCR/parse) → Extracting → Validating → Ready to review` (or `Auto-posted ✔` when confidence/policy allow). Each chip is tappable to see detail.

### 7.4 Empty / error / edge states
- **Empty:** the drop zone *is* the empty state, plus the email-in address and a "How capture works" link.
- **Errors:** unsupported type (clear list of accepted), file too large (size limit + compress tip), corrupt/unreadable (re-upload), password-protected PDF (prompt for password), virus detected (blocked, quarantined notice), blurry image (re-shoot suggestion), duplicate-on-upload (warn + link to existing).
- **Offline:** uploads queue with a "will send when online" chip.

---

## 8. AI Review Queue (SCR-REV-01 / SCR-REV-02)

The product's signature screen: where humans confirm or correct AI work fast.

### 8.1 Queue list — SCR-REV-01

```
┌──────────────────────────────────────────────────────────────────────┐
│ Review Queue                          12 to review · 3 low confidence  │
│ Filters: [All ▾][Type ▾][Confidence ▾][Date ▾][Counterparty ▾]  🔍    │
├───┬──────────┬──────────────┬────────┬──────────┬─────────┬──────────┤
│ ☐ │ Type     │ Counterparty │ Amount │ Conf.    │ Flags   │ Action   │
├───┼──────────┼──────────────┼────────┼──────────┼─────────┼──────────┤
│ ☐ │ Purchase │ Supplier X   │ €240   │ 96% 🟢   │ —       │ [Approve]│
│ ☐ │ Purchase │ Supplier Y   │ €1,180 │ 62% 🟠   │ Net≠Sum │ [Review] │
│ ☐ │ Purchase │ Supplier X   │ €240   │ 91% 🟢   │ ⧉ Dup?  │ [Review] │
│ ☐ │ Sale     │ Customer Z   │ €560   │ 88% 🟢   │ —       │ [Approve]│
└───┴──────────┴──────────────┴────────┴──────────┴─────────┴──────────┘
  [☑ Select all 🟢]   [Bulk approve (8)]            sort: confidence ▾
```
- **Confidence badge** colors: 🟢 high / 🟠 medium / 🔴 low. **Flags:** duplicate (⧉), missing field, validation mismatch, anomaly.
- Bulk approve restricted to high-confidence, flag-free items.
- Empty: "All caught up — nothing to review." Error: "Couldn't reprocess item" with retry per row.

### 8.2 Single-item review — SCR-REV-02 (the work surface)

```
┌──────────────────────────┬───────────────────────────────────────────┐
│  ORIGINAL DOCUMENT        │  EXTRACTED DATA            Confidence       │
│  ┌────────────────────┐   │  Supplier   Supplier X     🟢 98%          │
│  │                    │   │  VAT no.    BG123456789    🟢 validated ✓  │
│  │   [invoice image / │   │  EIK        123456789      🟢 ✓            │
│  │    PDF viewer with │   │  Invoice #  INV-552        🟢 97%          │
│  │    field highlights│   │  Date       2026-05-21     🟢              │
│  │    on hover]       │   │  Net        € 200.00       🟠 84%          │
│  │                    │   │  VAT 20%    € 40.00        🟢              │
│  │                    │   │  Total      € 240.00       🟢 (=net+VAT ✓) │
│  │                    │   │  IBAN       BG..           🟢 ✓            │
│  └────────────────────┘   │  Description Office supplies               │
│  [◀ prev] page 1/1 [next▶]│                                            │
├──────────────────────────┴───────────────────────────────────────────┤
│  AI ACCOUNTING SUGGESTION                                  why? ⓘ      │
│   Dr  601 Materials        € 200.00                                    │
│   Dr  4531 VAT receivable  € 40.00                                     │
│       Cr 401 Suppliers     € 240.00                                    │
│   VAT treatment: Standard 20%, deductible            [change ▾]        │
│   Reasoning: "Matches how you coded Supplier X 7× before."             │
├───────────────────────────────────────────────────────────────────────┤
│  ⧉ POSSIBLE DUPLICATE: Invoice #552 already posted 21 May  [Compare]   │
├───────────────────────────────────────────────────────────────────────┤
│  [Reject]      [Edit fields]            [Approve & post ✔]  ◀ sticky   │
└───────────────────────────────────────────────────────────────────────┘
```

- **OCR results:** each field shows value + confidence; clicking a field highlights its location on the document (and vice-versa).
- **AI accounting suggestion:** the proposed double-entry, editable; `why?` opens reasoning + the history it learned from.
- **VAT suggestion:** rate/treatment with a one-tap changer (standard / reduced / reverse-charge / intra-EU / exempt).
- **Duplicate warning:** inline banner with a side-by-side `Compare` to the existing posting; resolve as duplicate or confirm distinct.
- **Corrections feed the learning loop** (a subtle "the AI will remember this" confirmation).
- Keyboard-first: `A` approve, `E` edit, `R` reject, `→` next. Error states: validation failures block approval and pinpoint the field; "re-run AI" if extraction looks wrong.

---

## 9. Invoice Creation UX

Shared builder pattern across all four document types; the type sets fields, numbering series, and posting logic.

### 9.1 Invoice Builder — SCR-INV-02

```
┌─────────────────────────────────────────────────────────────────────┐
│ New Invoice                              Series: INV ·  No. 0143      │
│ Language: [BG ▾]   Currency: EUR (BGN shown)                          │
├───────────────────────────────────┬───────────────────────────────────┤
│ CUSTOMER                           │ DATES                             │
│ [ Search customer… ] ✓ VIES valid  │ Issue 2026-06-02  Due 2026-06-16  │
│ EIK 123…  VAT BG123…               │ Supply date 2026-06-02            │
├───────────────────────────────────┴───────────────────────────────────┤
│ LINE ITEMS                                              [+ Add line]   │
│ ┌──┬─────────────┬─────┬────────┬──────┬────────┬───────────────────┐ │
│ │# │ Item        │ Qty │ Unit € │ VAT% │ Net €  │ Line total €      │ │
│ ├──┼─────────────┼─────┼────────┼──────┼────────┼───────────────────┤ │
│ │1 │ Consulting  │  10 │  50.00 │  20  │ 500.00 │ 600.00            │ │
│ │2 │ [from catalogue ▾]                                             │ │
│ └──┴─────────────┴─────┴────────┴──────┴────────┴───────────────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│ NOTES / payment terms                  TOTALS                         │
│ [ … ]                                   Net      € 500.00             │
│                                         VAT 20%  € 100.00             │
│                                         TOTAL    € 600.00             │
│                                         (BGN 1,173.50 ref)            │
├───────────────────────────────────────────────────────────────────────┤
│ [Save draft]   [Preview]            [Issue]   [Issue & email] ◀ sticky │
└───────────────────────────────────────────────────────────────────────┘
```
- **Live preview** in selected language; **dual EUR/BGN totals** until Aug 2026.
- VAT auto-computed per line; reverse-charge/intra-EU auto-applied from customer's VAT status with a visible note.
- Catalogue autocomplete; sequential numbering enforced; mandatory Bulgarian invoice fields validated before issue.
- Empty: "Add a customer and your first line." Errors: missing mandatory field (blocks issue, highlights), VIES-invalid VAT (warn, allow override with reason), numbering gap warning, email-send failure (issued but not sent → retry).

### 9.2 Credit Note — SCR-INV-03
Same builder, but **must reference an original invoice** (`Search invoice to credit…`); amounts default to negative/return; reason field required; posting reverses proportionally. Error: crediting more than original (block), referencing a paid/closed period (controlled correction).

### 9.3 Debit Note — SCR-INV-04
References an original invoice and **adds** to it (price increase/extra charge); reason required; same VAT logic. Error: invalid reference, period lock.

### 9.4 Proforma — SCR-INV-05
Non-accounting document: **no ledger posting, no VAT ledger entry**; clearly badged "Proforma — not a tax document"; one-tap **Convert to invoice** (carries lines, assigns real number). Error: convert blocked if customer/VAT invalid.

---

## 10. Accounting UX

Designed so non-accountants can read it and accountants can work in it. Plain-language toggles ("Simple ⇄ Expert" view) on ledger screens.

### 10.1 Accounting design rules
Tabular figures, right-aligned amounts, drill-down everywhere (any number → its entries → its source document), period selector global to the module, and a persistent "as of" date.

### 10.2 General Ledger — SCR-ACC-02
```
┌─────────────────────────────────────────────────────────────────────┐
│ General Ledger        Account: [601 Materials ▾]   Period: May 2026 ▾ │
│ View: ◉ Expert  ○ Simple        [Export ▾]  [Print]                   │
├──────────┬───────────────┬──────────┬──────────┬──────────┬──────────┤
│ Date     │ Entry / Desc  │ Source   │ Debit €  │ Credit € │ Balance € │
├──────────┼───────────────┼──────────┼──────────┼──────────┼──────────┤
│ Opening  │               │          │          │          │  1,200.00 │
│ 03 May   │ #220 Supplier X│ doc #88 │   200.00 │          │  1,400.00 │
│ 11 May   │ #231 Supplier Y│ doc #91 │   980.00 │          │  2,380.00 │
│ …        │               │          │          │          │           │
│ Closing  │               │          │ 1,180.00 │     0.00 │  2,380.00 │
└──────────┴───────────────┴──────────┴──────────┴──────────┴──────────┘
```
- Click any row → entry detail → source document. Filters: account, date, source, amount, counterparty. Empty: "No movements in this period." Error: load banner; unbalanced-entry flag if any.

### 10.3 Trial Balance — SCR-ACC-03
```
┌─────────────────────────────────────────────────────────────────────┐
│ Trial Balance          As of 31 May 2026     [Compare to ▾] [Export]  │
├──────────┬──────────────────┬───────────┬───────────┬────────────────┤
│ Account  │ Name             │ Debit €   │ Credit €  │ (BGN ref)       │
├──────────┼──────────────────┼───────────┼───────────┼────────────────┤
│ 501      │ Cash             │  3,200.00 │           │                 │
│ 601      │ Materials        │  2,380.00 │           │                 │
│ 4531     │ VAT receivable   │    640.00 │           │                 │
│ 411      │ Customers        │  8,120.00 │           │                 │
│ 401      │ Suppliers        │           │  3,540.00 │                 │
│ …        │                  │           │           │                 │
├──────────┴──────────────────┼───────────┼───────────┤                 │
│ TOTALS (must balance ✓)      │ 18,420.00 │ 18,420.00 │                 │
└──────────────────────────────┴───────────┴───────────┴────────────────┘
```
- Balanced indicator prominent (green ✓ / red ✗). Drill from any account → ledger. Compare to prior period/year (handles the EUR/BGN changeover for comparatives). Empty: "No data for this period."

### 10.4 VAT Purchase/Sales Ledger — SCR-VAT-01/02
```
┌─────────────────────────────────────────────────────────────────────┐
│ Purchase Ledger (Дневник на покупките)     Period: May 2026 ▾         │
│ [Export ▾]    Validation: 1 warning ⚠                                 │
├────┬──────────┬───────────┬──────────┬────────┬────────┬────────┬─────┤
│ №  │ Doc no.  │ Supplier  │ VAT no.  │ Net €  │ VAT €  │ Total €│ Type│
├────┼──────────┼───────────┼──────────┼────────┼────────┼────────┼─────┤
│ 1  │ INV-552  │ Supplier X│ BG123…   │ 200.00 │ 40.00  │ 240.00 │ Std │
│ 2  │ INV-impt │ EU Vendor │ DE…      │ 500.00 │ —      │ 500.00 │ RC  │
└────┴──────────┴───────────┴──────────┴────────┴────────┴────────┴─────┘
  ⚠ Row 2: reverse-charge — ensure self-charged VAT entry  [Fix]
```
- Type column: Std / Reduced / RC (reverse charge) / Intra-EU / Exempt. Validation chips link to fixes. Filters: type, supplier, VAT rate, date, flagged-only. Empty: "No purchases recorded for this period." Error: per-row validation.

### 10.5 Report Viewer — SCR-RPT-02
Rendered report (P&L, balance sheet, VAT, aging) with period & compare controls, drill-down to source, and export to PDF/XLSX; multi-language output; schedule/share to client portal. Empty: pick a report. Error: generation failed → retry.

---

## 11. AI Accountant UX (SCR-AI-01)

Available two ways: **side panel** (context-aware, from any screen) and **full page** (focused). Same engine.

### 11.1 Side-panel layout
```
┌───────────────────────────────┐
│ AI Accountant            ✕     │
│ Context: VAT return · May 2026 │  ← knows where you are
├───────────────────────────────┤
│ You: How much VAT do I owe?    │
│                                │
│ AI: For May 2026 you owe       │
│ €1,260 VAT, due 14 June.       │
│ This is sales VAT €2,000 minus │
│ deductible purchase VAT €740.  │
│  ▸ Sources:                    │
│    • Sales ledger (May) [open] │
│    • Purchase ledger    [open] │
│    • ZDDS art. … (rule) [view] │
│  ⚠ Guidance — you decide &     │
│     approve before filing.     │
│  Suggested actions:            │
│   [Open VAT return] [Explain   │
│    the calculation]            │
├───────────────────────────────┤
│ [Ask something…            ➤ ] │
│ Quick: VAT? · Deadlines? · P&L?│
└───────────────────────────────┘
```

### 11.2 Four UX pillars
- **Chat interface:** language auto-matches the user (BG/EN); suggested quick prompts; remembers conversation within the company context; never blocks the rest of the UI (side panel).
- **Suggested actions:** answers end with action chips that deep-link into the app (`Open VAT return`, `Create the entry`, `Show overdue invoices`) — turning advice into one tap.
- **Explanations:** can expand any figure into a step-by-step breakdown ("Explain the calculation") and any posting into plain language ("What does this entry mean?").
- **Citations:** every factual claim links to its **source** — the company's own ledger/document (with `open`) and/or the relevant tax rule (with `view`). A persistent disclaimer frames output as guidance; the assistant explicitly **cannot file, approve, or sign**.

### 11.3 States
- Empty: greeting + example questions tailored to the screen.
- Thinking: streaming response with a subtle indicator.
- Low-confidence/unknown: "I'm not certain — here's what I found, please verify with your accountant," never a confident fabrication.
- Error: "Couldn't reach the assistant — your data is unaffected," with retry; core app keeps working.

---

## 12. NAP & KEP UX

### 12.1 VAT Submission Workflow — SCR-NAP-01 (stepper)
```
①Prepare ──▶ ②Validate ──▶ ③Approve ──▶ ④Sign (KEP) ──▶ ⑤Submit ──▶ ⑥Done
────────────────────────────────────────────────────────────────────────
① Period assembled from approved postings (ledgers + return preview)
② Validation panel:  ✓ 0 errors · ⚠ 2 warnings (review)   [Fix]
   AI summary: "Net VAT payable €1,260. Two reverse-charge items verified."
③ Submit for approval / Approve  (preparer ≠ approver if firm policy)
④ Sign with KEP  → [SCR-KEP-01]
⑤ Generate NAP files (+ VIES if applicable)
     MVP: [Download files] + guided "upload to NRA portal" steps
     Later: [Submit to NRA] directly
⑥ Confirmation archived · period LOCKED · audit updated
```
- Each step gated: can't advance with blocking errors; warnings require acknowledgment. The **commit step (Sign/Submit)** uses a distinct, deliberate visual treatment and a confirmation summary ("You are filing the May 2026 VAT return: payable €1,260").
- Empty: "No open period to file." Error: validation failures itemized with deep links; submission failure keeps the signed file and offers retry; never silently "succeeds."

### 12.2 KEP Signing Workflow — SCR-KEP-01
```
┌──────────────────────────────────────────────────────────┐
│ Sign with KEP                                             │
│ Signing: VAT return — May 2026  (hash shown)              │
│ Method:  ◉ Cloud QES   ○ Card/Token   ○ Mobile            │
│ Provider: [ B-Trust ▾ ]                                   │
│ Status:  ① Prepare ✓  ② Authenticate …  ③ Apply  ④ Verify │
│ [Cancel]                              [Continue with KEP] │
└──────────────────────────────────────────────────────────┘
```
- Stepper communicates each phase; platform never stores private keys; on success shows signer, certificate, timestamp, and signed-artifact reference (all written to audit trail).
- Errors: certificate expired/revoked, middleware missing (install guide), user cancelled, network — each with a clear recovery path. The thing being signed is always shown (no blind signing).

### 12.3 Compliance Dashboard — SCR-CMP-01
```
┌─────────────────────────────────────────────────────────────────────┐
│ Compliance                                                           │
├───────────────┬───────────────┬───────────────┬─────────────────────┤
│ VAT — May 2026│ NEXT DEADLINE  │ SAF-T          │ KEP                 │
│ Ready to file │ 14 Jun (12d)   │ Not in scope*  │ Configured ✓        │
│ [Open return] │ [Calendar]     │ [Learn more]   │ [Manage]            │
├───────────────┴───────────────┴───────────────┴─────────────────────┤
│ SUBMISSION HISTORY                                                   │
│ ┌──────────┬────────────┬─────────┬────────────┬──────────────────┐ │
│ │ Period   │ Type       │ Status  │ Signed by  │ Confirmation     │ │
│ ├──────────┼────────────┼─────────┼────────────┼──────────────────┤ │
│ │ Apr 2026 │ VAT return │ Filed ✓ │ M. Petrova │ [View] [Download]│ │
│ │ Apr 2026 │ VIES       │ Filed ✓ │ M. Petrova │ [View]           │ │
│ └──────────┴────────────┴─────────┴────────────┴──────────────────┘ │
│ *SAF-T applies from 2026 to large enterprises, widening by ~2030.    │
└─────────────────────────────────────────────────────────────────────┘
```
- Status semantics: Draft → Ready → Approved → Signed → Filed (with green check) / Rejected / Error. Each filed item links to its immutable confirmation and audit record. Empty: "No submissions yet." Error: clearly distinguishes "not filed" from "filed."

---

## 13. Mobile UX

Mobile is **capture-, approve-, and glance-first** — not full ledger editing.

### 13.1 What mobile does well
- **Capture:** camera-first with auto-crop/de-skew, multi-shot batch, and instant "processing" feedback.
- **Review/approve:** swipe-to-approve high-confidence items; tap to open the same review surface (stacked layout: document on top, fields below).
- **Dashboards:** the company/firm dashboards reflow to a single column; deadline strip pinned.
- **Invoicing:** quick invoice (recent customer + one line + issue/share).
- **AI Accountant:** full-screen chat with quick prompts.
- **Notifications:** push for "ready to review," deadlines, approvals needed, client uploads.

### 13.2 Mobile patterns
```
┌─────────────────┐    Bottom tab bar:
│  May 2026   🔔  │    [🏠 Home] [📄 Docs] [⊕] [✅ Review] [💬 AI]
│  ─────────────  │
│  VAT due in 3d  │    ⊕ = big central Capture button
│  €1,260 payable │
│  ─────────────  │    Review card (swipe):
│  2 to review →  │    ┌───────────────┐
│  4 to reconcile │    │ Supplier X €240│
│  ─────────────  │    │ 96% 🟢         │
│  Cash €24,310   │    │ ◀ reject  approve ▶
│  Receiv €8,120  │    └───────────────┘
└─────────────────┘
```
- **Bottom tab bar:** Home · Documents · **Capture (center)** · Review · AI.
- **Offline-tolerant:** captures queue and sync; clear sync status.
- **Out of scope on mobile (point to desktop):** manual journal editing, complex reconciliation, full report building, KEP signing of submissions (can *initiate*, complete where the signing method allows).
- Empty/error: mobile-appropriate, large tap targets, forgiving (re-shoot, retry); biometric unlock; never expose technical errors.

### 13.3 Client portal on mobile
The portal is effectively mobile-first for clients: "Send documents" (camera/upload), to-do list of requested docs, and "My reports." Two taps to send a receipt.

---

## 14. Wireframe Descriptions (library reference)

A consolidated index of the wireframes embedded above, plus layout intent for the remaining key screens, so a designer can frame the whole set in Figma. Each references its section.

| Wireframe | Section | Layout intent |
|-----------|---------|---------------|
| Global shell (top bar + rail + content + AI launcher) | §1.3 | Persistent frame all authenticated screens inherit |
| Main/Company Dashboard | §6.2 | Deadline strip → 4 KPI cards → attention list → risk feed + activity |
| Accountant Dashboard | §6.3 | 4 KPIs → cross-client work queue table → deadlines + at-risk |
| Firm Dashboard | §6.4 | 5 KPIs → deadline calendar → client health table + team workload + risk |
| Client Dashboard (portal) | §6.5 | Greeting → status/to-dos → 2 big actions → recent |
| Upload Center | §7.1 | Drop zone + email-in → processing table → CTA to review |
| Review Queue (list) | §8.1 | Filter bar → confidence-sorted table → bulk actions |
| Single-item Review | §8.2 | Document viewer (L) ↔ fields+suggestion (R) → duplicate banner → sticky commit |
| Invoice Builder | §9.1 | Header (customer/dates) → line-item table → notes + totals → sticky actions |
| General Ledger | §10.2 | Account+period header → movements table with running balance |
| Trial Balance | §10.3 | As-of header → debit/credit table → balanced indicator |
| VAT Ledger | §10.4 | Period header → ledger table with type + validation chips |
| AI Accountant (panel) | §11.1 | Context header → message thread w/ sources+actions → composer |
| VAT Submission stepper | §12.1 | 6-step horizontal stepper with gated progression |
| KEP Signing | §12.2 | Artifact + method/provider + phase stepper |
| Compliance Dashboard | §12.3 | 4 status cards → submission-history table |
| Mobile Home / tabs / review card | §13.2 | Single column, bottom tabs, central capture, swipe review |

**Additional layout notes (screens without an explicit wireframe above):**
- **Clients (SCR-FRM-02):** full-width data table with sticky header, left filter rail or top filter bar, saved-views chips, row → company workspace.
- **Document Detail (SCR-DOC-04):** identical split-view to single-item review but read/edit mode with version-history and audit tabs on the right.
- **Reconciliation (SCR-BNK-03):** two-column match board (transactions ↔ candidates) with a center "match" action and a splitter modal for partials.
- **Customer/Supplier Detail:** profile header + tabbed history (Overview / Invoices / Documents / Activity).
- **Reports Library/Viewer:** card grid → full-bleed rendered report with a right controls panel (period/compare/export).
- **Settings:** two-pane (settings nav left, form right) with inline validation and connection-status cards.
- **Onboarding:** centered single-column card with a top progress stepper.

---

## 15. Component Hierarchy

Organized as **Primitives → Patterns → Domain components → Compositions → Templates → Pages** (atomic-design aligned), for a clean Figma component library.

### 15.1 Primitives (atoms)
Button (primary/secondary/ghost/danger/commit), IconButton, Input, NumberInput, **MoneyInput (currency-aware, dual-display)**, Select, MultiSelect, Combobox/Autocomplete, Checkbox, Radio, Toggle, DatePicker, **PeriodPicker**, Textarea, Badge, **ConfidenceBadge**, StatusChip, Tag, Avatar, Tooltip, Spinner/Skeleton, ProgressBar, Divider, Link, Breadcrumb item.

### 15.2 Patterns (molecules)
FormField (label+control+help+error), SearchBar, FilterBar, FilterChip, KPITile, Card, Tabs, Stepper, Pagination, Toast/Notification, Banner (info/warn/error/success), Modal, SlideOverPanel, Dropdown/Menu, EmptyState, ErrorState, FileDropzone, UploadRow, ListRow, TableHeader, **DualCurrencyAmount**.

### 15.3 Domain components (organisms)
- **DocumentViewer** (zoom/pan, page nav, field-highlight overlay)
- **ExtractionFieldList** (field + value + confidence + validation)
- **JournalEntryEditor** (debit/credit lines, balance check)
- **VatTreatmentSelector** (std/reduced/RC/intra-EU/exempt)
- **ReviewQueueRow** / **ReviewWorkSurface**
- **DuplicateCompare** (side-by-side)
- **InvoiceLineTable** + **TotalsPanel** (with dual currency)
- **LedgerTable** / **TrialBalanceTable** / **VatLedgerTable** (drill-down enabled)
- **ReconciliationBoard** + **MatchSplitter**
- **DeadlineCard** / **DeadlineCalendar**
- **ClientHealthRow** / **TeamWorkloadBar**
- **RiskFeedItem** (with why + fix)
- **AiMessage** (text + **SourceCitation** + **SuggestedActionChips**)
- **SubmissionStepper** / **KepSignPanel**
- **AuditEventRow** (actor incl. AI, before→after)

### 15.4 Compositions & templates
- **AppShell** (TopBar + NavRail + Content + AiLauncher)
- **FirmShell**, **CompanyWorkspaceTemplate**, **ClientPortalTemplate**
- **ListPageTemplate** (FilterBar + Table + bulk actions)
- **DetailSplitTemplate** (viewer ↔ data)
- **DashboardGridTemplate**
- **WizardTemplate** (stepper + card)
- **WorkflowTemplate** (gated stepper + sticky commit bar)

### 15.5 Cross-cutting component requirements
- Every component is **localization-ready** (variable text length, Cyrillic + Latin), **theme-token-driven**, **responsive**, and **accessible (WCAG 2.1 AA)**.
- Every data component supports **empty / loading / error / permission-denied** states as first-class variants.
- Financial components default to **tabular figures** and **EUR-with-BGN-reference**.

---

## 16. Recommended User Journey

The intended end-to-end journey that ties the screens together, optimized for the "aha" moment and long-term retention.

### 16.1 First session (activation)
1. **Sign up → onboarding wizard** (SCR-ONB): EIK lookup auto-fills the company → set VAT status → (optional) connect bank → (optional) KEP.
2. **Process the first document immediately** (SCR-ONB-06): the wizard ends by having the user capture one receipt and watch it become a correct, posted entry in the Review Queue. *This is the activation moment — value before configuration.*
3. Land on the **Company Dashboard** with a short setup checklist for anything skipped.

### 16.2 Daily/weekly rhythm (habit)
- **Capture continuously** (mobile photo, email-in, portal) — frictionless.
- **Clear the Review Queue** in short sessions — confirm/correct; corrections quietly improve the AI.
- **Reconcile** when statements arrive (auto-match does most).
- **Glance at the dashboard** for position and nudges.

### 16.3 Monthly close (the payoff)
- Dashboard surfaces "VAT due in N days."
- Open **VAT Return** → validation + **AI summary** explains the result and flags risk.
- **Approve → KEP sign → generate/submit** to NAP → period locks → confirmation archived.
- The whole close is *review-and-confirm*, not data entry — delivering the "80–90% automated" promise.

### 16.4 Firm journey (scale)
- Principal monitors the **Firm Dashboard** (risk, deadlines, capacity) and assigns work.
- Staff work the **cross-client Work Queue** and switch contexts via the company switcher without losing their place.
- The **audit trail** underwrites the firm's liability and client trust.

### 16.5 Trust ladder (why users stay)
Capture works → suggestions are right → corrections stick → close is painless → compliance is safe and traceable. Each rung deepens reliance; explainability and human control keep trust intact even as automation increases.

---

## Appendix A — Screen-state matrix (Figma variant checklist)

For every data screen, build these frame variants:

| State | When | Notes |
|-------|------|-------|
| Default (populated) | Has data | Primary frame |
| Loading | Fetching | Skeletons, not spinners |
| Empty (first-use) | No data yet | Illustration + 1 best action |
| Empty (filtered) | Filters exclude all | "No results — adjust filters" |
| Error | Load/action failed | Banner + retry; preserve input |
| Permission-denied | Role lacks access | Explain + who to contact |
| Offline/queued | No connectivity | Queue + sync chip |
| Low-confidence / risk | AI uncertain or flagged | Amber/red treatment + why |

## Appendix B — Naming & handoff conventions

- **Frame naming:** `SCR-{AREA}-{NN} · {Screen name} · {State}` (e.g. `SCR-REV-02 · Single-item Review · Low-confidence`).
- **Areas:** AUTH, ONB, FRM, DSH, DOC, REV, SAL, INV, PUR, BNK, ACC, VAT, CMP, NAP, SAF, KEP, RPT, AI, AUD, SET, PRT.
- **Components** named by hierarchy: `Primitive/`, `Pattern/`, `Domain/`, `Template/`.
- **Tokens** referenced by name (no raw hex in frames) so theming and white-label are config.
- **Localization:** design every text-bearing component with a long-string (BG) and short-string (EN) variant; verify Cyrillic glyphs.
- **Currency:** all amount components include the dual-display variant with a flag to disable post-Aug-2026.

## Appendix C — Accessibility baseline (per screen)
Keyboard navigation and visible focus on all interactive elements; AA contrast (mind the light-blue/white pairing); labels and error text programmatically associated; the keyboard-first Review Queue (`A/E/R/→`); reduced-motion variant for streaming/skeletons; targets ≥44px on mobile.

---

*End of v1.0 UX architecture. Designed to be lifted directly into Figma: build the AppShell + token library first, then the component hierarchy (§15), then assemble screens from the inventory (§5) using the wireframes (§6–14) and the state matrix (Appendix A).*
