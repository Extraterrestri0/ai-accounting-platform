# AI Accounting Platform — Complete Frontend Architecture

**Document type:** Frontend architecture (conceptual — no code)
**Builds on:** Master Architecture, UX, Design System, Screen Specs, Domain Model, Rules Engine, AI Architecture, Backend Architecture (all v1.0)
**Acting as:** Principal Frontend Architect · Senior SaaS UI Architect · Senior Fintech Product Engineer · Senior UX Systems Architect
**Status:** v1.0 — frontend baseline

---

## Non-negotiable requirements (carried through every section)

- **Bulgarian default, English secondary; proper Cyrillic** (Bulgarian localized letterforms).
- **EUR primary + BGN reference** display (dual until 8 Aug 2026, then config-switchable).
- **Responsive** desktop / tablet / mobile, plus **PWA** for mobile capture.
- **Three modes/shells:** accounting-firm mode, single-company mode, client portal.
- **Integrates with the backend API** (typed contracts shared with NestJS).
- **Respects RBAC/ABAC in the UI for UX — but never relies on frontend permissions for security** (the backend always re-authorizes).
- **Uses the Design System exactly**, with **Figma-to-code consistency** via shared tokens.

---

## 1. Frontend Architecture Overview

### 1.1 Nature of the app
This is a **data-heavy, authenticated SaaS application** (a "workspace," not a content site): complex interactive screens (review queue, invoice builder, ledgers, reconciliation, filing steppers), permission-gated UI, real-time-ish updates, deep i18n, and offline-capable mobile capture. The architecture optimizes for **interaction richness, correctness, and design-system fidelity** — not for SEO inside the app (only marketing/auth pages benefit from SSR/SSG).

### 1.2 Shape
```
        ┌──────────────────────────────────────────────────────────┐
 PUBLIC │ Marketing (SSG) · Auth (SSR)                              │
        ├──────────────────────────────────────────────────────────┤
 SHELLS │ App Shell ─┬─ Firm Shell ─┬─ Company Workspace Shell      │
        │            └──────────────┴─ Client Portal Shell          │
        ├──────────────────────────────────────────────────────────┤
 LAYERS │ Screens (from Screen Specs) → Domain components →          │
        │ Patterns → Primitives  (all from the Design System)       │
        ├──────────────────────────────────────────────────────────┤
 STATE  │ Server state (TanStack Query) · UI state (light store) ·   │
        │ Form state (RHF+schema) · URL state · Session/Tenant ctx   │
        ├──────────────────────────────────────────────────────────┤
 PLATFORM│ Typed API client (BFF) · i18n · formatting (Intl) ·       │
        │ tokens/theme · a11y · PWA/offline · error boundaries      │
        └──────────────────────────────────────────────────────────┘
                         │ typed contracts (shared TS)
                         ▼
                 NestJS BFF / API  (tenant-scoped, RLS, authority)
```

### 1.3 Principles
1. **Design system is the source of truth.** Every screen is assembled from design-system components bound to tokens; no ad-hoc styling. Figma variables and code tokens share names and values.
2. **Server state ≠ client state.** Data from the API is cached/synchronized server state (TanStack Query); UI state is small and local. We don't dump everything into one global store.
3. **Permissions are UX hints, never security.** The UI shows/hides/disables using permission info from the backend purely to guide users; **every action is re-authorized server-side** and the UI assumes a privileged call can still be denied.
4. **Three shells, one core.** Firm, Company Workspace, and Client Portal are nested layouts over shared components — single codebase, mode-specific composition.
5. **Localized & formatted by construction.** No hard-coded strings or number/date/currency formats; BG-default, Cyrillic-first, EUR+BGN via shared components.
6. **Resilient & honest about state.** Every data surface has loading/empty/error/offline variants; processing/eventual-consistency states are surfaced, never hidden.
7. **Accessible and performant by default** (WCAG 2.1 AA; code-split, virtualized, lazy-loaded heavy parts).

---

## 2. Recommended Frontend Stack

### 2.1 Comparison

| Dimension | **Next.js (React)** | **Vite + React (SPA)** | **Vue/Nuxt** | **Angular** |
|-----------|---------------------|------------------------|--------------|-------------|
| TS alignment w/ NestJS + shared contracts | **Excellent** | **Excellent** | Good (TS, diff. ecosystem) | **Excellent (TS-first)** |
| Fit for data-heavy authed app | **Strong** | **Strong (pure SPA)** | Strong | **Strong** |
| Marketing + auth SSR/SEO in one tool | **Yes (SSG/SSR)** | No (separate) | Yes (Nuxt) | Limited |
| Nested layouts → 3 shells | **Excellent (App Router)** | Good (router config) | Good | Good |
| Built-in i18n routing (BG/EN) | **Yes** | Add-on | Yes (nuxt-i18n) | Yes |
| BFF / route handlers | **Yes** | No (separate) | Yes | No (separate) |
| Ecosystem for DS / Figma React components | **Largest** | **Largest** | Smaller | Smaller |
| PWA / offline | Good | **Good** | Good | Good |
| Talent (EU/BG) & velocity | **High** | **High** | Medium | Medium |
| Complexity / overhead | Medium (App Router) | **Low** | Medium | **High** |

### 2.2 Recommendation: **Next.js (React + TypeScript)**

**Choose Next.js with the App Router.** Reasoning:

1. **End-to-end TypeScript with the NestJS backend** — shared DTO/contract types eliminate a whole class of integration bugs and align with the design system's React component direction (the Figma library is built as React components per the Design System doc).
2. **One framework covers all three surfaces:** marketing (SSG/SEO), auth pages (SSR), and the authenticated app — no second toolchain.
3. **App Router nested layouts map perfectly to the three shells.** The route-group/layout model expresses App → Firm / Company Workspace / Client Portal cleanly, and the company-switcher routing falls out naturally (Section 4).
4. **Built-in locale routing** for **BG-default/EN** and **route handlers** that can serve as the **BFF** to the NestJS API (token handling, payload shaping, server-side fetch).
5. **Largest React ecosystem** for the data grid, document viewer, charts, forms, and the design-system component work, plus abundant EU/BG talent and high velocity.

**Nuance (senior judgment):** because the authenticated workspace is **heavily interactive behind auth**, most app screens are **client components**; React Server Components are used **judiciously** — for the initial shell/layout and first-paint data where they reduce bundle/latency — not as a dogma. SEO/SSR matters for marketing/auth, not the app.

**When the choice would differ (honest caveats):**
- **Vite + React** is a very strong, **simpler** alternative if the team wants a pure client SPA and handles the marketing site separately. It removes App Router/RSC overhead and is ideal for a behind-auth dashboard; we'd add a router (TanStack Router/React Router) and a separate marketing solution. Pick this if SSR is genuinely unneeded and minimalism is prized.
- **Vue/Nuxt** is excellent but **diverges from the React design-system/Figma direction** already established — needless re-tooling here.
- **Angular** is robust for large financial apps but heavier, slower to MVP, smaller startup talent pool, and off-ecosystem — the weakest fit for this team/velocity.

**Net:** **Next.js (App Router) + React + TypeScript**, with Vite+React the credible fallback if a pure SPA is preferred.

### 2.3 Supporting stack (recommended)
- **Language:** TypeScript (strict).
- **Styling/tokens:** Tailwind CSS configured from the **design-system tokens**, with **CSS variables** for theming modes (light/dark/white-label) and the **currency (dual/single) mode**.
- **Components:** in-house design-system library (optionally on a headless base like Radix for primitives) — built to the Design System spec.
- **Server state:** **TanStack Query** (caching, invalidation, optimistic updates, pagination).
- **Client/UI state:** lightweight store (**Zustand**) + React Context for cross-cutting (tenant/locale/theme); **URL** for navigable state.
- **Forms:** **React Hook Form + schema validation (Zod)** mirroring backend rules.
- **Tables:** **TanStack Table (headless)** + virtualization (TanStack Virtual).
- **Charts:** a React charting lib (e.g. Recharts/visx) for dashboards/CFO.
- **i18n:** **next-intl** (or equivalent) — BG default, locale routing, ICU pluralization.
- **Formatting:** native **Intl** (NumberFormat/DateTimeFormat) wrapped in shared utilities.
- **Docs/QA:** **Storybook** (living design system) + visual regression; **Playwright** (e2e); axe (a11y).
- **PWA:** service worker for installability/offline capture queue/push.
- **Hosting:** EU region (self-host or EU-resident managed); no data leaves the EU boundary.

---

## 3. Next.js App Architecture

### 3.1 Rendering strategy per area
- **Marketing pages:** static (SSG) — SEO, speed.
- **Auth pages (login/MFA/KEP/reset/register):** server-rendered (SSR) — secure, fast first paint, no heavy client bundle.
- **Authenticated app (shells + screens):** primarily **client-rendered**, because these are interactive, permission-gated, real-time-ish workspaces. **RSC is used for the shell/layout and initial data hydration** where it cuts bundle/latency; the heavy screens (review queue, builder, grids, viewer) are client components.
- **No sensitive data in static output;** authed data is fetched client-side (TanStack Query) or via RSC server fetch through the BFF with the user's session.

### 3.2 BFF (route handlers)
Next.js **route handlers act as a thin BFF**: they hold the session (httpOnly cookies), attach auth to NestJS API calls, shape/aggregate payloads for specific screens, and keep tokens off the client. The BFF never duplicates business logic or authority — the NestJS API remains the single source of authorization and truth.

### 3.3 App structure (conceptual)
- **Route groups** separate `(marketing)`, `(auth)`, and `(app)`; within `(app)`, nested layouts implement the three shells.
- **Layouts** compose the App Shell → shell-specific chrome → screen content (Section 5).
- **Loading/error boundaries** per route segment (skeletons, error states).
- **Server components** for layout/first data; **client components** for interaction; a clear, documented convention for which is which.
- **Streaming/Suspense** for progressive rendering of dashboards/lists.

---

## 4. Routing Architecture

### 4.1 Route map → shells (from the Sitemap)
```
(marketing)  /                      → Marketing (SSG)
(auth)       /auth/{login,mfa,kep,reset}  /register  /onboarding/* → Auth/Onboarding (SSR)
(app)
  /firm/*                           → FIRM SHELL  (dashboard, clients, work-queue,
                                       deadlines, reports, team, billing, settings)
  /c/[companyId]/*                  → COMPANY WORKSPACE SHELL
        /dashboard /documents /review /sales /purchases /banking
        /accounting /vat /compliance /receivables-payables /reports
        /ai-accountant /audit-trail /settings
  /portal/[companyId]/*             → CLIENT PORTAL SHELL
  /admin/*                          → (internal admin — separate, restricted)
```

### 4.2 Routing behaviors
- **Nested layouts = shells.** The `(app)` layout renders the App Shell; `/firm`, `/c/[companyId]`, `/portal/[companyId]` render their shell layouts; screens are leaves. Switching companies is a route change under `/c/[companyId]` that **preserves the current module sub-path** (an accountant on Client A's VAT lands on Client B's VAT).
- **Company switcher** updates `companyId` in the URL; the active tenant/company context (Section 9) follows.
- **Deep-linking & shareable URLs:** every screen, filtered list, and document is addressable; filters/sort/period live in the **URL query** so views are shareable and back/forward works.
- **Command palette (Cmd/Ctrl-K)** navigates to any company/screen/document/customer.
- **Route guards (UX only):** the router checks authentication and, using backend-provided permission/membership data, redirects or shows permission-denied — **but this is convenience, not security**; the backend re-authorizes every data/action call (Section 26). Unauthorized deep-links resolve to a graceful denied state, never a data leak.
- **Mobile** uses the same routes with shell chrome swapped for the bottom tab bar (Section 20).

---

## 5. App Shell Architecture

- **Composition:** a persistent outer frame inherited by every authenticated screen — **top bar** (logo, company switcher, global search, `+ Capture`, notifications bell, **BG|EN** toggle, account menu), **left nav rail** (collapsible, badge counts), content area, and the **persistent AI launcher** (bottom-right). Matches Design System §1.3.
- **Implementation:** the App Shell is a Next.js layout that wraps shell-specific layouts; chrome elements are design-system components fed by context (tenant, locale, permissions, unread/notification counts via server state).
- **Responsive:** rail collapses to icons on tablet and is replaced by the **bottom tab bar** on mobile; top bar condenses; the AI launcher persists.
- **State touchpoints:** tenant/company context, locale, theme/currency mode, permission set (for showing/hiding nav items), notification counts (live).
- **Performance:** shell renders fast (RSC-able), with screen content streamed/suspended inside it.

## 6. Firm Shell

- **Purpose/IA:** the multi-client cockpit (firm mode). Top-level nav: Dashboard · Clients · Work Queue · Deadlines · Reports · Team · Billing · Settings.
- **Key surfaces:** firm dashboard (KPIs/calendar/health/workload), cross-client **Work Queue** (one list across clients), client list with health/deadline/assignee, deadline calendar.
- **Cross-client data:** powered by **firm-rollup projections** from the backend; lists are server-paginated and virtualized; bulk actions across clients.
- **Entry to a client:** selecting a client routes into the **Company Workspace Shell** under `/c/[companyId]`, preserving context.
- **Permissions:** firm-admin vs staff views differ (UX hints from backend); enforcement server-side.

## 7. Company Workspace Shell

- **Purpose/IA:** the single-company environment used by owners/freelancers directly and by accountants after drilling into a client. Full module nav (Documents, Review, Sales, Purchases, Banking, Accounting, VAT, Compliance, Receivables/Payables, Reports, AI Accountant, Audit, Settings) per the UX doc.
- **Scoping:** everything under `/c/[companyId]` is scoped to that company; the active company is in the URL + context; all API calls carry it (backend RLS-enforced).
- **Progressive disclosure:** Simple ⇄ Expert toggle on accounting screens (one component, two presentations).
- **Badges:** nav items show counts (to-review, unreconciled, period-due) from live server state.

## 8. Client Portal Shell

- **Purpose/IA:** a deliberately minimal, friendly shell for the firm's end client — Dashboard · Send documents · Reports · Archive · Notifications.
- **Constraints:** single-company scope (one `companyId`), `Client User` role only; reduced chrome (no accountant tooling), large touch targets, jargon-free copy.
- **Mobile-first:** the portal is effectively a mobile-first experience (camera capture, to-do list, reports); same routes, simplified shell.
- **Isolation:** portal users can never see firm/other-company surfaces; routes and data are scoped and backend-enforced.

## 9. State Management

State is **categorized**, each with the right tool — avoiding a single mega-store.

| State category | Examples | Tool | Notes |
|----------------|----------|------|-------|
| **Server state** | documents, entries, returns, lists, dashboards | **TanStack Query** | cached, invalidated, optimistic; the bulk of app data |
| **Session/identity context** | user, **active tenant/company**, permissions, locale, theme, currency mode | React Context (+ small store) | provided at the shell; read everywhere |
| **UI state** | panel open, selected rows, wizard step, filters not in URL | **Zustand** / local state | small, ephemeral |
| **Navigable state** | filters, sort, period, tab, opened entity | **URL query** | shareable, back/forward-safe |
| **Form state** | in-progress forms, drafts | **React Hook Form** | per-form, with autosave |

- **No business logic in the store.** The store holds UI/coordination state; truth comes from server state.
- **Permission set** is loaded once per company context and used as **UX hints** (show/hide/disable); never the security boundary.
- **Tenant/company context switch** invalidates company-scoped queries and resets company-scoped UI state.

## 10. Server State & API Integration

- **Typed API client** generated from / shared with the **NestJS contracts** (single source of truth for request/response and event payload shapes) — compile-time safety across the boundary.
- **TanStack Query** for fetching/caching: query keys namespaced by **tenant/company + resource + params**; automatic refetch/staleness; **invalidation on mutations** and on relevant **domain events** (Section: real-time).
- **Mutations:** typed, with **idempotency keys** (matching the backend) for create/post/upload/submit; **optimistic updates** where safe (e.g. approve a review item, mark read) with rollback on failure.
- **Pagination:** **cursor-based** (matching backend) with infinite scroll/virtualization for ledgers, queues, documents.
- **Eventual consistency:** some reads are **projections** that lag writes; the UI shows **processing states** (e.g. "extracting…", "posting…") and reconciles when the projection catches up — never pretends instant consistency it doesn't have.
- **Real-time updates:** the review queue, notifications, processing status, and dashboards subscribe to **server-sent events / websockets** (or smart polling) so new items and status changes appear without manual refresh. AI chat uses **SSE streaming**.
- **Error mapping:** the backend's uniform error envelope (code, message, field errors, correlation id) maps to inline field errors, form summaries, page banners, or toasts (Section 28); the correlation id is surfaced for support, internals never leaked.
- **Auth/refresh:** session via httpOnly cookies through the BFF; transparent token refresh; **a privileged call can still 403** even if the UI showed it — handled gracefully (Section 26).

## 11. Forms Architecture

- **Library:** **React Hook Form + Zod** schemas. The **validation schema mirrors backend rules** (shared where possible) so the client validates the same constraints — but the backend remains authoritative.
- **Fields = design-system components:** FormField, MoneyField, VatSelector, AccountPicker, DatePicker/PeriodPicker, Combobox (customers/catalogue/accounts), etc., with the design-system state model (default/hover/focus/error/disabled/read-only).
- **Validation UX:** inline on blur for format checks (EIK/IBAN/VAT pattern), on submit for completeness; **async validation** (EIK lookup, VIES) shows trailing spinner → ✓/warning with override-and-reason; error text says what + how to fix; **never lose user input** on error.
- **Multi-step flows:** onboarding wizard and the **filing stepper** are modeled as **state machines** (clear steps, gated transitions, can't advance past blocking errors); progress preserved.
- **Drafts & autosave:** long forms (invoice builder, manual entry) autosave drafts; recover on reload.
- **Money & locale:** MoneyField handles locale decimal/grouping; dual-currency display via shared component; numbers tabular.
- **Permission-aware:** fields/actions disable per permission hints; submit still re-authorized server-side.

## 12. Tables & Data Grid Architecture

- **Engine:** **TanStack Table (headless)** + **virtualization** for large ledgers/queues; rendered with design-system table components (header, rows, density, zebra/dividers, status chips).
- **Server-driven:** sort/filter/paginate **server-side** (cursor pagination) for big datasets; filters live in the URL; saved views.
- **Financial rendering:** **tabular figures, right-aligned amounts, dual EUR/BGN**, negative formatting, running balance, totals/footer rows, balanced indicator (trial balance) — all from design-system financial components.
- **Interactions:** row selection + **sticky bulk action bar**, row actions (hover/`⋯`), **drill-down** (figure → entry → source document via slide-over or route), expandable grouped rows, sticky header/first column.
- **Bulk actions** gated by permission + (for the review queue) confidence/flag eligibility.
- **States:** skeleton rows (loading), in-table empty (first-use/filtered), error banner + retry, validation-flagged rows with markers.
- **Performance:** virtualization, memoized cells, windowed rendering; never render thousands of DOM rows.
- **Accessibility:** proper table semantics, keyboard navigation, screen-reader labels for status/confidence cells.

---

## 13. Document Viewer Architecture

- **Capabilities:** render PDF (multi-page), images (JPG/PNG/TIFF multi-frame); zoom/pan, page navigation, fit-to-width, rotate.
- **Field-highlight overlay:** the viewer renders **bounding-box overlays** synced to the extraction field list — hovering a field highlights its location and vice-versa (the Review/Document-Detail signature interaction). Coordinates come from the extraction data (AI doc).
- **Performance:** lazy-load the viewer (heavy) only on screens that need it; page-by-page/tile rendering for large PDFs; virtualize multi-page navigation; thumbnails generated server-side.
- **Source:** documents loaded via **short-lived signed URLs** from EU storage (Backend §22); never embedded with credentials in the URL beyond the signed token.
- **Security:** render in a **sandboxed** context; no execution of document-embedded scripts; treat document content as untrusted; PDFs rendered via a safe renderer, not raw browser navigation.
- **States:** skeleton while loading; "couldn't render — download original" fallback; download original always available.

## 14. Upload Center Architecture

- **Capture surfaces:** drag-and-drop, file browse, **camera capture** (mobile/PWA), and the email-in address display; per the UX/Design System.
- **Direct-to-storage uploads:** files upload via **signed URLs straight to EU object storage** (offloading the app server), with the backend notified to create the Document and enqueue processing; **chunked/resumable** uploads for large files and flaky mobile networks.
- **Per-format UX:** PDF multi-page/split prompt; image auto-crop/enhance preview + blur/quality gate; **XML "structured detected"**; ZIP expansion with per-file progress; password-protected PDF prompt.
- **Progress & status:** per-file progress bars and **processing-stage chips** (Queued→Scanning→Reading→Extracting→Validating→Ready) updated via real-time events; CTA to the Review Queue.
- **Offline (PWA):** captures **queue locally** when offline and **sync** when back online, with a clear sync-status chip; idempotent (content hash) so re-sync never duplicates.
- **Validation/errors:** unsupported type, too large, corrupt, virus-blocked, blurry, duplicate-on-upload — each with the design-system error state and fix.

## 15. AI Review Queue Architecture

The product's signature screen — built for speed and trust.

- **Two views:** the **list** (filter bar + confidence-sorted virtualized table + bulk action bar) and the **single-item work surface** (DocumentViewer left ↔ ExtractionFieldList + AISuggestion + duplicate/anomaly banners right + sticky action bar).
- **Rendering AI signals:** **ConfidenceBadge** tiers (🟢/🟠/🔴), **validation badges** (✓ deterministic), field-highlight sync, the **`why?`** reasoning expander, **DuplicateCompare** side-by-side — all design-system domain components fed by the AISuggestion/Extraction data.
- **Keyboard-first:** A/E/R/→ shortcuts; fully operable without mouse (accessibility + accountant speed).
- **Optimistic + safe:** approve applies optimistically with rollback on server rejection; **bulk approve** is enabled only for high-confidence, flag-free, validation-clean items (eligibility from backend); blocking validation disables approval and pinpoints the field.
- **Real-time:** new items and status changes stream in (SSE/websocket); the queue badge updates live.
- **Corrections feed learning:** edits post back as the structured feedback signal (backend), with a subtle "the AI will remember this" confirmation.
- **Authority:** the UI can approve/correct/reject (human action) but the **AI never auto-acts in the UI**; auto-applied items (gated server-side) appear already-posted but reversible.

## 16. Invoice Builder Architecture

- **Shared builder, four types** (invoice/credit/debit/proforma) driven by a `type` prop that sets fields, numbering series, posting behavior, and required references (credit/debit reference an original; proforma doesn't post).
- **Dynamic line items:** RHF field-array (add/remove/reorder lines); per-line VAT via **VatSelector**; **live totals** (net, VAT by rate, total) with **DualCurrencyAmount** recomputed as the user types.
- **Autocomplete:** **CustomerSelect** (with VIES/EIK validation badge) and catalogue **Combobox**; counterparty/product data from server state.
- **Live preview:** rendered in the **selected language** with dual currency; matches the eventual PDF.
- **Numbering:** sequential number displayed (assigned server-side on issue to guarantee gaplessness); the UI never invents numbers.
- **Drafts:** autosave; **sticky action bar** (Save/Preview/Issue/Issue&email; proforma → Convert to invoice).
- **Validation:** mandatory BG fields gate issue; VIES-invalid → override-with-reason; line math; email-send failure → issued-but-not-sent state with retry.

## 17. Accounting Screens Architecture

- **Screens:** Journal, General Ledger, Trial Balance, Chart of Accounts — built on the data-grid architecture (§12) with **drill-down** (figure → entry → source document) everywhere.
- **Global controls:** module-level **PeriodPicker** and **Simple ⇄ Expert** view toggle (one component, two presentations) so non-accountants and accountants share screens.
- **Ledger/Trial Balance:** running balance, opening/closing emphasis, **balanced indicator**, comparatives that handle the **EUR/BGN changeover**; export to PDF/XLSX (server-generated, downloaded).
- **Chart of Accounts:** class-grouped tree (1–7) + detail; edits permission-gated; used-account protections surfaced from backend.
- **Journal editor:** JournalEntryEditor with AccountPicker + MoneyField + **BalanceIndicator** (must balance to post); manual entry desktop-only; posting via the backend (immutable).
- **Read-heavy:** these are projection-backed reads; large ledgers virtualized; period-bounded queries.

## 18. VAT & Compliance Screens Architecture

- **VAT screens:** Purchase/Sales ledgers (grids with type tags + validation chips), **VAT Return** (the gated stepper), **VAT Validation Center** (category tiles + issue list + resolve drawer).
- **Stepper as a state machine:** Prepare→Validate→Approve→Sign→Submit→Done — **gated transitions** (can't advance past blocking errors), current/done/future step styling, **commit confirmations** ("Filing May 2026 — €1,260 payable; locks the period") before the weighty action.
- **NAP/KEP flows:** SubmissionStepper, KepSignPanel (method/provider/phase, **never blind signing**, never key custody — the UI orchestrates the handoff and shows the artifact + hash), SubmissionHistory, Compliance dashboard with status cards (incl. **SAF-T "not in scope yet"** informational state).
- **Commit semantics in UI:** commit/sign/file use the design-system **Commit button** treatment; disabled with explanation when the user lacks Approver role, KEP isn't configured, or validation blocks — **but the backend re-checks all of it** (UI is hints only).
- **Status fidelity:** Draft→Ready→Approved→Signed→Filed/Error rendered precisely; "not filed" never looks like "filed."

## 19. AI Accountant & AI CFO UI Architecture

- **Surfaces:** the **persistent side panel** (context-aware, from any screen) and a **full-page** variant; same engine, plus the **AI CFO** insight-canvas variant (forecast cards + advisory chat).
- **Streaming:** responses **stream via SSE** with a typing indicator; the UI renders incrementally.
- **Citations & actions:** **SourceCitation** chips link to the company's own data (ledger/document — opens it) and tax-KB references (opens the rule); **SuggestedActionChips** are **deep-links** into app routes ("Open VAT return"). A persistent **GuidanceNote** frames output as advisory.
- **Context awareness:** the panel passes the current screen/period as context to the backend so answers are relevant.
- **Read-only by construction:** the AI UI offers **navigation and drafting only** — **no Commit/Sign/File controls ever live in the AI surface**; it can link to a workflow, but the human performs the action there. This mirrors the backend's AI-exclusion guarantee.
- **States:** greeting + tailored examples (empty), streaming, low-confidence ("verify with your accountant"), and a graceful "assistant unavailable — your data is unaffected" error that never blocks the app.
- **CFO specifics:** forecast charts + scenario inputs; estimates clearly **labeled with assumptions**; figures sourced/cited from the ledger, never invented.

---

## 20. Mobile / PWA Architecture

- **Strategy:** responsive single codebase + **installable PWA** (no separate native app at MVP). Mobile is **capture-, approve-, glance-first**, not full ledger editing.
- **Mobile shell:** the App Shell swaps to a **bottom tab bar** (Home · Documents · **Capture FAB** · Review · AI) with safe-area insets; dashboards reflow to single column; tables become cards/sheets; popovers become **bottom sheets**.
- **Capture:** camera-first with auto-crop/de-skew, multi-shot batch; **offline capture queue** (service worker) that syncs when online; idempotent by content hash.
- **Review on mobile:** **MobileReviewCard** (viewer on top, fields below, swipe-to-approve high-confidence; tap for full review).
- **Offline support:** read-cached recent data; queued captures/drafts; clear **sync-status** indicator; graceful degradation when offline (capture works; complex actions deferred).
- **Push notifications** (PWA) for deadlines, items to review, approvals, client uploads.
- **Biometric unlock** entry for returning users (where platform supports).
- **Out-of-scope on mobile** (point to desktop): manual journal editing, complex reconciliation, **KEP signing of submissions** (can initiate where the method allows).
- **Performance:** smaller mobile bundles via code-splitting; the heavy viewer/grid load on demand.

## 21. Internationalization (BG / EN)

- **Engine:** **next-intl** (or equivalent) with **locale routing**; **Bulgarian is the default locale**, English secondary; per-user preference; in-app **BG|EN** toggle.
- **Externalized strings:** all UI copy in message catalogs keyed by namespace; **no hard-coded strings**; **ICU pluralization**; **no fragment concatenation** (whole parameterized messages handle grammar/word order). **No text baked into icons/images.**
- **Fallback chain:** selected → BG → EN; never show a missing-key to users.
- **Cyrillic-first typography:** load a font with **Bulgarian localized forms (`locl`)** enabled and language set to Bulgarian; **subset/optimize Cyrillic + Latin** for performance; tabular figures (`tnum`) on all numbers (Design System §3).
- **Text expansion:** components designed for variable length (BG vs EN differ); no fixed-height text containers; verify both languages in every component (Storybook + visual regression).
- **AI/document language:** the AI assistant responds in the selected language; document/extraction handles BG+EN source; generated documents render in the chosen language while preserving legally required Bulgarian elements.
- **Locale-aware formatting** (numbers/dates/currency) via Section 22; legal/compliance terms keep Bulgarian forms (НАП, ЗДДС, КЕП, ЕИК) with EN gloss.

## 22. Currency & Number Formatting

- **Single source of formatting:** shared utilities over **`Intl.NumberFormat` / `Intl.DateTimeFormat`** keyed by locale — never ad-hoc formatting.
- **Locale rules:** BG → `1 234,56 €`, `02.06.2026`; EN → `€1,234.56`, `2026-06-02` (Design System §23). **Tabular figures** everywhere money appears.
- **EUR primary + BGN reference:** the **DualCurrencyAmount** component shows EUR prominent + BGN muted (≈), driven by a **currency mode (`dual` until 8 Aug 2026, then `single`)** implemented as a CSS-variable/config mode so BGN hides by configuration, no redesign.
- **Fixed rate** 1 EUR = 1.95583 BGN held as config; conversion + **rounding** per legal convention; tooltip shows the rate.
- **Financial polarity:** negatives with sign/parentheses + color (never color alone); right-aligned in tables.
- **Money input:** MoneyField parses locale input, stores canonical decimal (never float), and never performs silent currency conversion in inputs.

## 23. Design System Implementation

- **Tokens are the single source of truth.** Design-system primitive + semantic tokens (Design System §2–§5) are implemented as **CSS variables** and surfaced to **Tailwind** via config; **components reference semantic tokens only** (no raw hex/px).
- **Theming via modes:** light (default), dark (future), and **white-label** (firm branding) are **CSS-variable mode swaps**; the **currency dual/single mode** is likewise a mode — all without component changes (mirrors the Figma Variables modes).
- **Figma-to-code consistency:** token **names and values match Figma Variables exactly**; component **names and variants/props mirror the Figma library** (Primitive/Pattern/Domain/Template); screen frames map to routes via the `SCR-` IDs. A change to a token in the shared definition flows to both Figma and code.
- **Storybook as the living design system:** every component documented with all variants/states (incl. empty/loading/error/permission-denied) in **BG and EN** and in the dual-currency mode; **visual regression** guards fidelity.
- **No bespoke styling in screens:** screens compose components; one-off styles are a code-review failure.

## 24. Component Library Structure

- **Atomic layers** (mirroring Design System §15):
  - **Primitives:** Button (incl. **Commit**), Input, MoneyField, Select, Combobox, Checkbox/Radio/Toggle, DatePicker, **PeriodPicker**, Badge, **ConfidenceBadge**, StatusChip, Tag, Tooltip, Skeleton, ProgressBar.
  - **Patterns:** FormField, FilterBar, KPITile, Card, Tabs, Stepper, Modal, SlideOver, Toast, Banner, **EmptyState**, **ErrorState**, FileDropzone.
  - **Domain:** DocumentViewer, ExtractionFieldRow, AISuggestionBlock, DuplicateCompare, InvoiceLineTable, TotalsPanel, LedgerTable, VatLedgerTable, ReconciliationBoard, DeadlineCard, RiskFeedItem, AiMessage (+SourceCitation +SuggestedActionChips), SubmissionStepper, KepSignPanel, **MoneyField/DualCurrencyAmount/VatSelector/AccountPicker**.
  - **Templates:** AppShell, FirmShell, CompanyWorkspace, ClientPortal, ListPage, DetailSplit, DashboardGrid, Wizard, Workflow.
- **Structure:** a versioned internal package (or workspace module) consumed by the app; clear public API; documented in Storybook; semantic versioning.
- **State variants built-in:** every data component ships default/loading/empty/filtered-empty/error/permission-denied variants (Section 28).
- **Cross-cutting:** all components are localization-ready, token-driven, responsive, and accessible by construction.

## 25. Accessibility Architecture (WCAG 2.1 AA)

- **Semantic HTML first;** ARIA only to fill gaps (roles/labels for custom widgets — combobox, tabs, dialog, grid).
- **Keyboard:** every interactive element reachable/operable; **visible focus ring** (blue, 2px+offset); logical order; the **Review Queue fully keyboard-driven** (A/E/R/→); **command palette** (Cmd/Ctrl-K); modals **trap focus** and restore on close; skip-to-content.
- **Color is never the only signal:** status/confidence pair **icon + text + color**; financial polarity shows sign/label. **Contrast** meets AA — **light-blue/white pairings use blue-600/700 for text** (Design System caution).
- **Screen-reader semantics:** confidence/status have SR text ("confidence high, 96 percent", "status: filed"); tables use proper header semantics; icon-only buttons have names; live regions announce async results/processing.
- **Targets ≥44px** (mobile especially); **reduced-motion** variants for skeletons/streaming; **200% zoom** without loss; pinch-zoom not disabled.
- **Localized a11y:** SR text and labels localized BG/EN.
- **Testing:** automated **axe** checks in CI + Storybook; keyboard/SR manual passes on critical flows (review, invoicing, filing).

---

## 26. Security Considerations (frontend)

- **Permissions are UX, not security.** The UI uses backend-provided permission/role data only to **show/hide/disable** for a clean experience. **Every privileged action is re-authorized by the backend**, and the UI is built to handle a `403` even on an element it displayed (graceful denial, no broken state). No authorization logic lives only in the frontend.
- **Token handling:** sessions via **httpOnly, secure, SameSite cookies** through the Next.js BFF — **tokens never in JS-accessible storage** (mitigates XSS token theft); transparent refresh server-side.
- **XSS/CSP:** strict **Content-Security-Policy**, output encoding, no `dangerouslySetInnerHTML` on untrusted content, sanitized rendering of any user/document-derived text; document content is **untrusted** and never executed.
- **No secrets in the frontend;** no business rules that must be trusted; API base config only.
- **Sensitive data hygiene:** never put PII/financial identifiers in **URLs/query strings** or client logs; signed-URL tokens are short-lived; analytics exclude PII.
- **Document/file safety:** uploads validated client-side for UX but **scanned/sandboxed server-side**; viewer sandboxed; image/PDF proxied via backend to avoid SSRF and to apply signed access.
- **Dependency & supply chain:** lockfiles, dependency/vulnerability scanning in CI, Subresource Integrity for any external scripts (avoided where possible), EU-only third parties.
- **Tenant context integrity:** the active company is reflected in the URL/context, but the **backend derives authority from the session, not the client-sent id** — a tampered `companyId` yields denial, not access.
- **AI surface:** holds **no privileged controls**; cannot be socially-engineered into actions it has no UI for; document-borne instructions are never surfaced as actions.

## 27. Performance Optimization

- **Code splitting** per route/shell; **lazy-load heavy components** (DocumentViewer, data grid, charts, PDF renderer) on demand.
- **Virtualization** for large lists/ledgers/queues; windowed rendering; memoized cells; avoid rendering thousands of nodes.
- **Server state caching** (TanStack Query) with sensible staleness + **prefetch on hover/route intent**; **optimistic updates** for snappy interactions.
- **RSC/SSR judiciously:** shell + first data server-rendered to cut bundle/latency; interactive screens client-side; **streaming/Suspense** for progressive dashboards.
- **Asset performance:** **font subsetting** (Cyrillic+Latin) + `font-display` strategy; image optimization; **bundle budgets** enforced in CI; tree-shaking; route-level prefetch.
- **Skeletons over spinners;** progressive rendering; debounced search/filter inputs; **Web Vitals** monitored (LCP/INP/CLS), regressions flagged.
- **Real-time efficiency:** SSE/websocket for pushes instead of aggressive polling; backoff and reconnection.
- **Mobile:** smaller bundles, deferred heavy modules, offline cache for repeat visits.

## 28. Error / Loading / Empty States

Implemented as **first-class component variants** (Design System §19–21), never afterthoughts.

- **Loading:** **skeletons** matching final layout (no layout shift); **progressive/streamed** rendering; inline button spinners (label persists); **document processing chips** (Queued→…→Ready).
- **Empty:** first-use (illustration + one best action), filtered ("no results — clear filters"), all-clear (positive), not-in-scope (e.g. SAF-T informational), portal-friendly.
- **Error:** field inline → form summary → section banner → page banner → **toast** for async results → full-page error; **offline** ("you're offline — changes saved, will sync"); **permission-denied** (who to contact); **compliance/submission failure never silent**.
- **Error boundaries:** per route segment + around risky widgets (viewer, charts) so one failure doesn't crash the shell; **retry** affordances; **never lose user input** on error.
- **Honest async/eventual-consistency:** show processing states and reconcile when projections catch up; distinguish blocking (red) from caution (amber).
- **Tone:** calm, actionable, localized; correlation id surfaced for support, internals hidden.

## 29. Testing Strategy

- **Unit:** components and hooks (rendering, props, variants); formatting/i18n utilities.
- **Integration:** forms (validation, async EIK/VIES, submit), data flows (query/mutation/invalidation), state transitions (wizard/stepper).
- **Visual regression:** **Storybook + Chromatic** (or equivalent) across all component states, **BG and EN**, light + dual-currency mode — guards **design-system/Figma fidelity**.
- **Accessibility:** automated **axe** in CI + Storybook; keyboard/SR manual passes on review/invoicing/filing.
- **E2E (Playwright):** critical journeys — onboarding→first document, document→review→approve, invoice issue, VAT period close→sign→file (with backend test doubles), firm company-switch, portal upload — on desktop and mobile viewports.
- **Permission-rendering tests:** assert UI correctly shows/hides/disables per role **and** that the app **handles a backend `403` gracefully** even when an element was shown (proving frontend permissions are not the security boundary).
- **Contract tests:** typed against the shared NestJS contracts; CI fails on schema drift.
- **i18n tests:** key coverage, no missing strings, **text-expansion/layout** checks in both languages, Cyrillic rendering.
- **Performance tests:** bundle budgets, Web Vitals checks, virtualization under large datasets.

## 30. Frontend Development Roadmap

Aligned to the product phases.

- **MVP — the core loop, three shells.** App Shell + Company Workspace (and basic Firm shell + company switcher) + Auth/Onboarding; design-system component library + tokens + Storybook; **Upload Center, OCR Review Queue, Document Detail/Archive, Invoice Builder (4 types), Accounting screens (journal/ledger/trial balance/CoA), VAT (ledgers/return/validation), Banking (import/reconcile), NAP Phase-A + KEP flows, Reports, AI Accountant chat, dashboards, audit trail, settings**; full **BG/EN + Cyrillic**, **EUR+BGN** dual display, responsive + **PWA capture**, RBAC-aware UI, a11y baseline.
- **Phase 2 — depth & scale.** **Client Portal**, SAF-T export UI, direct NAP submission UI, **AI CFO** + AI Recommendations Center, firm-grade bulk tooling + cross-client work queue, open-banking connect UI, richer reports/custom report builder, white-label theming mode, enhanced offline/mobile, performance hardening.
- **Phase 3 — proactive & expansion.** E-invoicing/clearance UI when mandated, **additional locale/jurisdiction** (proving the i18n/jurisdiction separation), proactive compliance/insight surfaces, deeper personalization, and broader (still human-gated) automation surfacing.
- **Throughout:** design-system fidelity, accessibility, and the "permissions are UX not security" discipline are gates on every release, not later add-ons.

---

## Closing — how the frontend holds together

- **One framework, three shells:** **Next.js App Router** nested layouts express Firm / Company Workspace / Client Portal over a shared App Shell and one design-system component library — single codebase, mode-specific composition.
- **Right state in the right place:** **TanStack Query** for server state, a light store + context for UI/session, the URL for navigable state, RHF+Zod for forms — no mega-store, truth from the API.
- **Design system, exactly:** tokens are the single source of truth, implemented as CSS variables/Tailwind, with **Figma-to-code name/value parity** and Storybook + visual regression as the guardrails.
- **Bulgarian-first, EUR-native:** BG-default Cyrillic i18n with fallback, and EUR-primary + BGN-reference formatting via shared Intl-based components and a config-switchable currency mode.
- **Safe by construction:** the UI **uses permissions for UX but trusts only the backend**; httpOnly cookies, strict CSP, sandboxed document rendering, no secrets, no privileged AI controls — and it degrades gracefully (offline, errors, denials) without ever losing user input.
- **Fast, accessible, tested:** code-split, virtualized, lazy-loaded, Web-Vitals-watched; WCAG 2.1 AA; unit/integration/visual/e2e/a11y/contract tests gate fidelity and correctness.
- **Recommended stack:** **Next.js (App Router) + React + TypeScript + Tailwind(tokens) + TanStack Query/Table + RHF/Zod + next-intl + Storybook/Playwright**, EU-hosted — with **Vite + React** the credible simpler-SPA alternative.

Paired with the backend architecture, this completes the buildable end-to-end picture: a Bulgarian-first, EUR-native, design-system-faithful, permission-safe frontend that turns the capture → understand → propose → approve → record → comply loop into a fast, trustworthy product across desktop, tablet, mobile, firm mode, single-company mode, and the client portal.

*End of v1.0 Frontend Architecture.*
