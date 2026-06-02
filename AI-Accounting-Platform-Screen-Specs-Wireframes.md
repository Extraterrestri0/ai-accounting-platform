# AI Accounting Platform — Complete Screen Specification & Wireframe Documentation

**Document type:** Screen specifications + wireframe documentation (design only — no code)
**Builds on:** *Master Architecture (v1.0)*, *Complete UX Architecture (v1.0)*, *Complete Design System (v1.0)*
**Audience:** Figma designers (frame-by-frame build), product, frontend
**Status:** v1.0 — screen baseline

---

## How to read this document

Every screen is specified with the **15 required fields** (Name · Purpose · Role access · Layout · Components · Actions · Filters · Tables · Widgets · Validation · Empty · Loading · Error · Mobile · Navigation) followed by an **ASCII wireframe** showing structure and zoning.

**Shared conventions (apply to every authenticated screen, not repeated each time):**
- **Global shell:** Top bar (logo · company switcher · global search · `+ Capture` · 🔔 · BG|EN · account) + left nav rail + content + persistent **AI launcher** (bottom-right). See Design System §1.3.
- **Design tokens:** colors, type, spacing from the Design System; amounts use **EUR primary + muted BGN reference (≈) until 8 Aug 2026** via the Currency mode.
- **Universal states baseline:** skeleton loading (not spinners), purposeful empty states, calm errors that preserve input, permission-denied graceful, offline-queued capture. Per-screen notes below describe *screen-specific* variations.
- **Role vocabulary:** Account Owner, Tenant Admin · Senior Accountant/Approver, Accountant, Bookkeeper, Reviewer/Auditor, Client User, Read-only Viewer · AI is an audited non-human actor that proposes only.
- **Screen IDs** map to the UX inventory (e.g. `SCR-REV-02`); new screens introduced here get new IDs.
- Wireframe legend: `[Button]` `[ field ]` `▾` select · `▸/◀▶` nav · `✓ ⚠ !` status · `🟢🟠🔴` confidence · `≈` BGN reference.

---

# AUTH

### SCR-AUTH-01 — Login
- **Purpose:** authenticate an existing user quickly and safely.
- **Role access:** public (unauthenticated).
- **Layout:** centered single-column card on a calm brand-tinted background; logo top; language toggle top-right.
- **Components:** Card, FormField (email, password), Checkbox (remember device), Button (primary, link, secondary KEP), language toggle, error banner.
- **Actions:** Log in · Log in with KEP · Forgot password · Switch language · Go to Registration.
- **Filters:** none.
- **Tables:** none.
- **Widgets:** brand lockup, trust microcopy ("Bank-grade security").
- **Validation:** email format; password required; generic failure message (no field-specific "wrong password" for security); rate-limit notice after N attempts.
- **Empty:** n/a (form is the state).
- **Loading:** button inline spinner ("Signing in…").
- **Error:** inline non-specific "Email or password is incorrect"; locked-account notice; rate-limit countdown.
- **Mobile:** full-width card, large fields, biometric-unlock prompt for returning users.
- **Navigation:** → MFA (SCR-AUTH-04) · → KEP login (SCR-AUTH-05) · → Forgot password (SCR-AUTH-03) · → Registration (SCR-AUTH-02) · success → Dashboard / Firm Dashboard.

```
                       [ Logo ]            BG | EN
            ┌─────────────────────────────────────┐
            │  Welcome back                        │
            │  Email    [ ___________________ ]    │
            │  Password [ ___________________ ] 👁  │
            │  ☐ Remember this device              │
            │  [        Log in        ]            │
            │  ──────────  or  ──────────          │
            │  [  Log in with KEP (QES)  ]         │
            │  Forgot password?   ·   Create account│
            └─────────────────────────────────────┘
                🔒 Bank-grade security · EU-hosted
```

### SCR-AUTH-02 — Registration
- **Purpose:** create a new account (firm or single business/freelancer) and start onboarding.
- **Role access:** public.
- **Layout:** centered card; account-type chooser at top (segmented control: *Business/Freelancer* vs *Accounting firm*); form below.
- **Components:** Segmented control (account type), FormField (name, email, password+strength meter, phone optional), Checkbox (accept terms), Button primary, language toggle, password-strength widget.
- **Actions:** Create account · Choose account type · Accept terms · Switch language · Go to Login.
- **Filters:** none.
- **Tables:** none.
- **Widgets:** password-strength meter; account-type explainer (1-liner per type).
- **Validation:** email format + uniqueness (async, "email already in use → log in"); password policy (length/complexity) shown live; terms must be checked to enable submit; name required.
- **Empty:** n/a.
- **Loading:** submit spinner; async email-check spinner in trailing slot.
- **Error:** inline per field; account-type required; terms-not-accepted blocks submit (highlight).
- **Mobile:** full-width; segmented control stacks if needed; large tap targets.
- **Navigation:** success → Onboarding wizard (SCR-ONB-01) · → Login.

```
                       [ Logo ]            BG | EN
   ┌──────────────────────────────────────────────────┐
   │  Create your account                              │
   │  I am a:  [● Business / Freelancer] [ Accounting firm]│
   │  Full name [ _______________________ ]            │
   │  Email     [ _______________________ ]  ⟳ checking │
   │  Password  [ _______________________ ] 👁          │
   │            ▓▓▓▓░ Strong                            │
   │  ☐ I accept the Terms and Privacy Policy          │
   │  [           Create account            ]          │
   │  Already have an account?  Log in                 │
   └──────────────────────────────────────────────────┘
```

### SCR-AUTH-03 — Forgot Password
- **Purpose:** request and complete a secure password reset.
- **Role access:** public.
- **Layout:** centered card; two states in one flow: (a) request by email, (b) set-new-password (from email link).
- **Components:** FormField (email / new password + confirm + strength), Button primary, confirmation panel, back link.
- **Actions:** Send reset link · Set new password · Back to login.
- **Filters / Tables:** none.
- **Widgets:** confirmation state ("If that email exists, we've sent a link"), password-strength meter, link-expiry note.
- **Validation:** email format; on reset step — password policy, confirm-match, link validity/expiry; throttling.
- **Empty:** n/a.
- **Loading:** send/submit spinner.
- **Error:** expired/invalid link → "Request a new link"; mismatch; throttled.
- **Mobile:** full-width.
- **Navigation:** → Login; from email link → reset step → success → Login.

```
   ┌────────────────────────────────────┐    (reset step)
   │  Reset your password               │    ┌──────────────────────────┐
   │  Email [ _________________ ]       │    │ Choose a new password    │
   │  [      Send reset link      ]     │    │ New     [ __________ ] 👁 │
   │  ← Back to login                   │    │ Confirm [ __________ ]    │
   │  (after submit:)                   │    │ ▓▓▓▓ Strong              │
   │  ✓ If that email exists, a link    │    │ [   Set password   ]     │
   │    is on its way.                  │    └──────────────────────────┘
   └────────────────────────────────────┘
```

### SCR-AUTH-04 — MFA Setup & Challenge
- **Purpose:** set up and verify a second authentication factor (mandatory for staff/accountant roles).
- **Role access:** authenticated (during onboarding or first sensitive action); challenge for all MFA-enabled users at login.
- **Layout:** centered card; setup = method choice + QR/secret + verify; challenge = code entry.
- **Components:** Method selector (Authenticator app / SMS / Email), QR/secret display, code input (segmented, auto-advance), recovery-codes panel, Button primary, resend timer, trust-device checkbox.
- **Actions:** Choose method · Scan/enter secret · Verify code · Save recovery codes · Use another method · Resend · Trust device.
- **Filters / Tables:** none.
- **Widgets:** QR code, copyable secret, recovery-codes list (download/print), countdown timer.
- **Validation:** code length/numeric; wrong/expired code; too-many-attempts lock; recovery-codes must be acknowledged as saved.
- **Empty:** n/a.
- **Loading:** verify spinner.
- **Error:** invalid/expired code; QR scan fallback (manual secret); method-unavailable.
- **Mobile:** "open authenticator" deep link; large code input.
- **Navigation:** setup success → continue onboarding/return to action; challenge success → Dashboard.

```
 (setup)                                  (challenge)
 ┌────────────────────────────────┐      ┌──────────────────────────┐
 │ Set up two-factor auth         │      │ Enter your code          │
 │ Method: [● App][SMS][Email]    │      │  [_][_][_] [_][_][_]     │
 │  ┌──────┐  scan this QR or     │      │  Resend in 0:24          │
 │  │ ▣▣▣▣ │  enter: ABCD-EFGH    │      │  ☐ Trust this device     │
 │  └──────┘                      │      │  [     Verify     ]      │
 │ Code [_][_][_][_][_][_]        │      │  Use another method      │
 │ ⚠ Save your recovery codes:    │      └──────────────────────────┘
 │   [ download ] [ print ]       │
 │ [   Verify & enable   ]        │
 └────────────────────────────────┘
```

### SCR-AUTH-05 — KEP Login
- **Purpose:** strong authentication via qualified electronic signature.
- **Role access:** public/authenticated (alternative login + step-up auth).
- **Layout:** centered card; method + provider + phase stepper.
- **Components:** Method selector (Cloud QES / Card-Token / Mobile), Provider select (B-Trust/Evrotrust/StampIT…), phase stepper, status messages, Button primary, help link.
- **Actions:** Select method/provider · Continue with KEP · Cancel · Get help (middleware).
- **Validation:** certificate present/valid/not-expired/not-revoked; middleware detected (card method).
- **Empty / Loading:** phase stepper communicates progress ("Authenticate…").
- **Error:** cert not found/expired/revoked; middleware missing (install guide); user cancelled; timeout — each with recovery.
- **Mobile:** mobile-signing deep link; card method points to desktop.
- **Navigation:** success → MFA (if required) / Dashboard.

```
   ┌───────────────────────────────────────────┐
   │ Log in with KEP                            │
   │ Method:  ◉ Cloud QES  ○ Card/Token  ○ Mobile│
   │ Provider:[ B-Trust ▾ ]                     │
   │ ① Prepare ✓  ② Authenticate …  ③ Verify    │
   │ [ Cancel ]              [ Continue with KEP]│
   │ Trouble? Install middleware guide          │
   └───────────────────────────────────────────┘
```

---

# ONBOARDING

A linear wizard (centered card + top progress stepper) that ends by processing the user's first document. Steps share: `[← Back] [Skip for now] [Continue]` and a progress stepper `①Profile ②Company ③VAT ④Bank ⑤KEP ⑥First doc`.

### SCR-ONB-02 — Company Setup
- **Purpose:** create/identify the company via EIK and auto-fill its legal data.
- **Role access:** Account Owner / Tenant Admin (firm: creates a client company).
- **Layout:** centered card; EIK lookup hero field → auto-filled details → editable fields.
- **Components:** EIK lookup field (async), FormField (legal name, address, NACE/activity, fiscal year start), CoA selector (default BG national CoA), base-currency display (EUR), logo upload (optional), stepper.
- **Actions:** Look up EIK · Confirm/edit details · Select chart of accounts · Set fiscal calendar · Continue.
- **Filters / Tables:** none.
- **Widgets:** EIK-validation badge, auto-fill confirmation, activity-code picker.
- **Validation:** EIK checksum + existence (async); name required; fiscal-year valid; duplicate-company warning.
- **Empty:** prompt to enter EIK ("We'll fetch your company details").
- **Loading:** EIK lookup spinner; skeleton on auto-fill.
- **Error:** EIK not found/invalid checksum → manual entry allowed; lookup service down → manual + retry.
- **Mobile:** full-width; numeric keypad for EIK.
- **Navigation:** → VAT Setup (SCR-ONB-03); firm path returns to client list after finish.

```
  ①●②③④⑤⑥                                   Company setup
  ┌───────────────────────────────────────────────────┐
  │  Enter your company's EIK                          │
  │  EIK [ 123456789 ]  ✓ found                        │
  │  ── auto-filled (editable) ──                      │
  │  Legal name [ Acme OOD            ]                │
  │  Address    [ Sofia, …            ]                │
  │  Activity   [ 62.01 Programming ▾ ]                │
  │  Fiscal year starts [ 01 Jan ▾ ]                   │
  │  Chart of accounts  [ BG National CoA ▾ ]          │
  │  Base currency: EUR  (BGN legacy supported)        │
  │  [← Back]   [Skip]            [ Continue ]         │
  └───────────────────────────────────────────────────┘
```

### SCR-ONB-03 — VAT Setup
- **Purpose:** capture VAT registration status and period, driving all downstream VAT treatment.
- **Role access:** Account Owner / Tenant Admin / Senior Accountant.
- **Layout:** centered card; VAT-status selector → conditional fields.
- **Components:** Radio group (VAT-registered / not registered / registering), FormField (VAT number, registration date), Period selector (monthly default), VIES toggle (intra-EU activity), info notes.
- **Actions:** Select status · Enter VAT number · Set effective date · Continue.
- **Validation:** VAT number format (`BG`+EIK) + VIES check (async) when registered; effective date required; consistency with EIK.
- **Empty:** explainer of why VAT status matters.
- **Loading:** VIES validation spinner.
- **Error:** VAT invalid/VIES down (allow override + reason, flag for later); date inconsistencies.
- **Mobile:** full-width; conditional fields reveal smoothly.
- **Navigation:** → Bank (SCR-ONB-04).

```
  ①②●③④⑤⑥                                   VAT setup
  ┌───────────────────────────────────────────────────┐
  │  VAT status                                        │
  │  ◉ VAT-registered  ○ Not registered  ○ In process  │
  │  VAT number [ BG123456789 ]  ✓ VIES valid          │
  │  Registered since [ 01.03.2024 ]                   │
  │  VAT period: [ Monthly ▾ ]  (filing by the 14th)   │
  │  ☐ I trade with other EU countries (VIES)          │
  │  ⓘ This determines how VAT is applied on documents │
  │  [← Back]   [Skip]            [ Continue ]         │
  └───────────────────────────────────────────────────┘
```

### SCR-ONB-05 — KEP Setup
- **Purpose:** connect a qualified e-signature for signing/filing (skippable, completed later).
- **Role access:** Account Owner / Senior Accountant/Approver.
- **Layout:** centered card; method + provider + test-signature.
- **Components:** Method selector (Cloud QES / Card-Token / Mobile), Provider select, connection-status card, test-sign action, help link, stepper.
- **Actions:** Choose method/provider · Connect · Test signature · Skip for now.
- **Validation:** certificate validity; middleware detection; successful test sign confirms setup.
- **Empty:** "You can set this up later" reassurance.
- **Loading:** connection/test spinner with phase labels.
- **Error:** middleware missing (guide); cert expired/revoked; provider unavailable.
- **Mobile:** mobile-signing path; card method → "finish on desktop."
- **Navigation:** → First doc (SCR-ONB-06).

```
  ①②③④●⑤⑥                                   KEP setup (optional)
  ┌───────────────────────────────────────────────────┐
  │  Connect your e-signature (KEP)                    │
  │  Method  ◉ Cloud QES ○ Card/Token ○ Mobile         │
  │  Provider[ Evrotrust ▾ ]                           │
  │  Status: ● Not connected                           │
  │  [ Connect ]  then  [ Test signature ]             │
  │  Needed to sign and file to NAP — can do later.    │
  │  [← Back]   [Skip for now]        [ Continue ]     │
  └───────────────────────────────────────────────────┘
```

### SCR-ONB-06 — First User Wizard (process first document)
- **Purpose:** deliver the activation "aha" — capture one document and watch it become a posted entry.
- **Role access:** any onboarding user.
- **Layout:** centered card → capture/upload → live processing stages → result preview → finish.
- **Components:** FileDropzone + camera, processing-stage chips, ExtractionFieldList preview, AISuggestionBlock preview, ConfidenceBadge, Button primary, "use a sample" link.
- **Actions:** Upload/photograph a document · Watch processing · Review the result · Finish to dashboard · Use sample doc.
- **Validation:** accepted formats; readable image (else re-shoot); reuses Upload validation.
- **Empty:** the dropzone + "no document handy? Try a sample."
- **Loading:** stage chips (Scanning→Reading→Extracting→Validating→Ready).
- **Error:** unreadable/unsupported → guidance; offer sample.
- **Mobile:** camera-first; the canonical first mobile moment.
- **Navigation:** finish → Company Dashboard (SCR-DSH-01) with setup checklist.

```
  ①②③④⑤●⑥                              See it work
  ┌───────────────────────────────────────────────────┐
  │  Add your first document                           │
  │  ┌───────────────────────────────────────────────┐│
  │  │  ⬆ Drag a bill/receipt  ·  [Browse] [📷 Photo] ││
  │  └───────────────────────────────────────────────┘│
  │  Processing:  Scanning✓ Reading✓ Extracting▓ …     │
  │  ── result preview ──                              │
  │  Supplier X · € 240 · VAT 20% 🟢 96%               │
  │  AI posting: Dr 601 / Dr 4531 / Cr 401             │
  │  No document handy? Use a sample                   │
  │  [          Finish & go to dashboard          ]    │
  └───────────────────────────────────────────────────┘
```

---

# DASHBOARD

### SCR-DSH-01 — Small Business Dashboard
- **Purpose:** give an owner/freelancer an at-a-glance picture of money, obligations, and what needs doing.
- **Role access:** Account Owner, Senior Accountant, Accountant, Read-only Viewer (company scope).
- **Layout:** deadline strip (top) → 4 KPI tiles → "Needs your attention" list → two-column (AI risk feed | recent activity) → AI prompt.
- **Components:** DeadlineStrip, KPITile ×4 (Cash, Receivables, Payables, VAT this period), AttentionList, RiskFeedItem list, ActivityItem list, AI prompt button, SetupChecklist (first-use).
- **Actions:** Open module from any card · Review items · Reconcile · Resolve duplicate · Ask AI · Complete setup steps.
- **Filters:** period selector (month) top-right.
- **Tables:** none (lists/tiles).
- **Widgets:** KPI tiles with trend ▲▼ + dual currency; deadline countdown; risk feed with why+fix.
- **Validation:** n/a (read/navigate).
- **Empty:** new company → SetupChecklist replaces tiles.
- **Loading:** skeleton tiles + list placeholders; progressive fill.
- **Error:** per-card error chip with retry; never blank the page.
- **Mobile:** single column; deadline strip pinned; tiles stack 1-up; bottom tab nav.
- **Navigation:** cards → Banking / Receivables / Payables / VAT Return / Review Queue; AI prompt → AI panel.

```
 Company ▸ Dashboard                         Period: May 2026 ▾
 ⏰ VAT return due in 3 days · 2 need approval            [Review]
 ┌──────────┬──────────┬──────────┬───────────────────────┐
 │CASH      │RECEIV.   │PAYABLES  │VAT THIS PERIOD         │
 │€24,310   │€8,120 ▲  │€3,540    │payable €1,260 · 14 Jun │
 │≈BGN…     │4 overdue │1 due     │[VAT return]            │
 └──────────┴──────────┴──────────┴───────────────────────┘
 NEEDS YOUR ATTENTION
  • 2 documents to review (1 low conf.)        [Review →]
  • 1 duplicate invoice warning                [Resolve →]
  • 4 unreconciled transactions                [Reconcile →]
 ┌───────────────────────────┬───────────────────────────┐
 │ AI RISK FEED              │ RECENT ACTIVITY           │
 │ ⚠ Unusual amount Suppl X  │ ✓ Invoice #142 issued     │
 │ ⚠ VAT mismatch doc #88    │ ✓ 6 expenses posted (AI)  │
 └───────────────────────────┴───────────────────────────┘
              [ Ask AI Accountant about this month ▸ ]
```

### SCR-DSH-02 — Accountant Dashboard
- **Purpose:** a staff accountant's personal cross-client work view.
- **Role access:** Accountant, Senior Accountant, Bookkeeper (scoped to assigned companies).
- **Layout:** 4 KPI tiles (My clients, To review, Returns due, Awaiting my approval) → cross-client Work Queue table → two-column (My deadlines | Clients at risk).
- **Components:** KPITile ×4, work-queue Table (multi-company) with bulk-select, ConfidenceBadge, DeadlineCard list, ClientHealthRow list, bulk action bar.
- **Actions:** Open/approve queue items · Bulk approve (high-conf) · Assign · Switch into a client · Open returns.
- **Filters:** company, type (review/reconcile/VAT), confidence, age, status, "this week".
- **Tables:** Work Queue — `☐ · Client · Type · Item · Confidence · Age · [Action]`.
- **Widgets:** confidence & age sort; deadline list; at-risk clients.
- **Validation:** bulk approve restricted to high-confidence flag-free items.
- **Empty:** "No items assigned — pick up from the firm queue."
- **Loading:** skeleton rows.
- **Error:** per-row reprocess error + retry; partial-load notice.
- **Mobile:** queue as stacked cards (swipe-approve); KPIs scroll.
- **Navigation:** rows → Review (SCR-REV-02) / Reconciliation / VAT Return; client → Company Workspace.

```
 My Work                                          This week ▾
 ┌─────────┬─────────┬──────────┬────────────────────────┐
 │CLIENTS  │TO REVIEW│RETURNS DUE│AWAITING MY APPROVAL    │
 │38       │57       │6 (7d)     │4                       │
 └─────────┴─────────┴──────────┴────────────────────────┘
 MY WORK QUEUE (cross-client)                 [Bulk approve]
 ┌──┬─────────┬─────────┬──────────┬───────┬──────────────┐
 │☐ │Client   │Type     │Item      │Conf.  │Age           │
 │☐ │Acme OOD │Review   │Invoice #5│96% 🟢 │2h    [Approve]│
 │☐ │Beta EOOD│Reconcile│3 txns    │ —     │1d    [Open]   │
 │☐ │Gama Ltd │VAT      │May return│ —     │due 2d 🟠[Open]│
 └──┴─────────┴─────────┴──────────┴───────┴──────────────┘
 ┌───────────────────────────┬───────────────────────────┐
 │ DEADLINES (mine)          │ CLIENTS AT RISK           │
 └───────────────────────────┴───────────────────────────┘
```

### SCR-DSH-03 — Accounting Firm Dashboard
- **Purpose:** practice-wide situational awareness for the principal/admin — risk, deadlines, capacity, usage.
- **Role access:** Account Owner, Tenant Admin (firm).
- **Layout:** 5 KPI tiles → compliance deadline calendar → two-column (Client health table | Team workload + firm-wide AI risk).
- **Components:** KPITile ×5 (Clients, To review, Returns due, Overdue, Doc volume vs plan), DeadlineCalendar (week/month/list), ClientHealthRow table, TeamWorkloadBar list, RiskFeedItem (firm), usage gauge.
- **Actions:** Add client · Open at-risk client · Rebalance assignments · Open calendar/returns · View usage/billing.
- **Filters:** period, assignee, client status/health, deadline window, tag.
- **Tables:** Client health — `Client · Health · Next due · Assignee`.
- **Widgets:** deadline calendar; team capacity bars (overload flag); document-volume gauge vs plan.
- **Validation:** n/a.
- **Empty:** new firm → "Add your first client" hero.
- **Loading:** skeleton tiles/calendar/table.
- **Error:** degraded-data banner; stale-flag on cards.
- **Mobile:** KPIs scroll; calendar → list; tables → cards.
- **Navigation:** → Clients (SCR-FRM-02) · Work Queue · Deadlines · Team · Billing · client drill-in.

```
 Firm Overview                                       June 2026 ▾
 ┌────────┬────────┬─────────┬────────┬───────────────────┐
 │CLIENTS │REVIEW  │RETURNS  │OVERDUE │DOC VOLUME         │
 │142     │318     │41 (7d)  │12 ⚠    │8.2k / 10k plan    │
 └────────┴────────┴─────────┴────────┴───────────────────┘
 COMPLIANCE CALENDAR (week)              [List][Month]
  Mon · Tue ▣9 returns · Wed · Thu ▣14th VAT(28) · Fri
 ┌───────────────────────────┬───────────────────────────┐
 │ CLIENT HEALTH (risk first)│ TEAM WORKLOAD             │
 │ Delta OOD 🔴 · 14 Jun     │ Ivan ██████░ 78%          │
 │ Zeta EOOD 🟠 · 14 Jun     │ Petar ███████ 86% ⚠       │
 │ Acme OOD  🟢 · 14 Jun     │ [Rebalance]               │
 │ [All clients →]           │ AI RISK (firm-wide) …     │
 └───────────────────────────┴───────────────────────────┘
```

### SCR-DSH-04 — Client Portal Dashboard
- **Purpose:** give the firm's end client a friendly, jargon-free home: what's needed, send docs, see reports.
- **Role access:** Client User (single company scope).
- **Layout:** greeting + status banner → two big action buttons (Send documents / View reports) → requested-documents to-do → recent.
- **Components:** status banner (all-set vs requests), big action Buttons ×2, to-do list (requested docs with upload), ActivityItem list.
- **Actions:** Send documents · Upload requested item · View reports · Open notification.
- **Filters:** none.
- **Tables:** none (lists).
- **Widgets:** "what we need from you" to-do; status banner; accountant contact.
- **Validation:** upload format/size (friendly).
- **Empty:** warm "Nothing to do — we'll let you know."
- **Loading:** simple skeleton.
- **Error:** plain "Couldn't load, try again" — no technical detail.
- **Mobile:** primary experience; camera-first send; two taps to send a receipt.
- **Navigation:** → Portal Upload (SCR-PRT-02) · Portal Reports (SCR-PRT-03) · Archive · Notifications.

```
 Hello, Maria 👋        Your accountant: Petrov & Co
 ┌──────────────────────────────────────────────────┐
 │ 📩 We need 2 documents:                            │
 │   • April bank statement        [Upload]          │
 │   • Fuel receipts               [Upload]          │
 └──────────────────────────────────────────────────┘
 [  ⊕ Send documents  ]      [  📄 View my reports  ]
 RECENT
  • You sent 5 documents (2 Jun) — received ✓
  • New report available: May summary   [View]
```

---

# DOCUMENTS

### SCR-DOC-02 — Upload Center
- **Purpose:** get documents in (any accepted format) and into processing fast.
- **Role access:** Bookkeeper, Accountant, Senior Accountant, Client User (portal variant).
- **Layout:** large dropzone + email-in address (top) → live upload/processing table → CTA to Review Queue.
- **Components:** FileDropzone (drag/browse/photo), email-in address with copy, UploadRow list with stage chips, format/size hint, Button (Go to Review).
- **Actions:** Drag/drop · Browse · Take photo · Copy email-in address · Cancel upload · Go to Review · Split multi-invoice PDF.
- **Filters:** none (status implicit per row).
- **Tables:** processing list — `thumb · filename · progress · stage/status`.
- **Widgets:** per-format handling (PDF multi-page/split prompt; image auto-crop/enhance; XML "structured detected"; ZIP expand with file count); processing-stage chips.
- **Validation:** accepted types (PDF/JPG/PNG/TIFF/XML/ZIP); size limit; malware scan; blur detection; password-protected PDF prompt; duplicate-on-upload warning.
- **Empty:** the dropzone *is* the empty state + email-in + "How capture works".
- **Loading:** per-file progress bars + stage chips.
- **Error:** unsupported type (accepted list); too large (compress tip); corrupt; password-protected (prompt); virus (blocked); blurry (re-shoot); duplicate (link to existing).
- **Mobile:** camera-first; multi-shot batch; queued/offline sync chip.
- **Navigation:** → Review Queue (SCR-REV-01) · Document Archive · Document Detail.

```
 Upload documents
 ┌──────────────────────────────────────────────────────┐
 │   ⬆ Drag & drop files here                            │
 │   or  [Browse]   [📷 Take photo]                       │
 │   PDF · JPG · PNG · TIFF · XML · ZIP  (up to NN MB)    │
 └──────────────────────────────────────────────────────┘
 Or forward bills to:  inbox-acme@app.bg   [Copy]
 PROCESSING
 ┌──────┬──────────────┬───────────┬─────────────────────┐
 │thumb │invoice.pdf   │▓▓▓▓░ 80%  │Scanning…            │
 │thumb │receipts.zip  │✓ 12 files │Extracting (7/12)    │
 │thumb │photo.jpg     │✓          │Ready to review ✔    │
 └──────┴──────────────┴───────────┴─────────────────────┘
                         [ Go to Review Queue (3) → ]
```

### SCR-DOC-01 — Document Archive
- **Purpose:** find, filter, and audit any document the company holds.
- **Role access:** Bookkeeper+, Reviewer/Auditor (read), Client User (own, portal).
- **Layout:** filter bar (sticky) → grid/list toggle → document table → pagination.
- **Components:** FilterBar, view toggle (grid/list), StatusChip, source icon, ConfidenceBadge, Table, bulk action bar, Pagination.
- **Actions:** Open · Upload · Export · Bulk tag · Bulk download · Re-run AI · Mark duplicate.
- **Filters:** type, status, date range, counterparty, amount range, source (upload/email/portal), tag, **full-text search**.
- **Tables:** `thumb · type · counterparty · date · amount(€/≈BGN) · status · source · confidence`.
- **Widgets:** thumbnail preview on hover; saved views.
- **Validation:** export scope; bulk-action permission checks.
- **Empty:** first-use → "No documents yet — upload or forward to your inbox"; filtered → "No results — clear filters".
- **Loading:** skeleton rows/cards.
- **Error:** search-failed inline + retry; per-row load error chip.
- **Mobile:** list view default; filters in bottom sheet; tap → detail.
- **Navigation:** → Document Detail (SCR-DOC-04) · Upload · Review Queue.

```
 Documents                                       [+ Upload]
 [Type ▾][Status ▾][Date ▾][Counterparty ▾][Amount ▾] 🔍  ▦ ▤
 ┌────┬────────┬───────────┬────────┬──────────┬─────┬──────┐
 │thmb│Type    │Counterpty │Date    │Amount    │Src  │Status│
 │▢   │Purchase│Supplier X │21 May  │€240 ≈BGN │📧   │Posted│
 │▢   │Sale    │Customer Z │20 May  │€560      │⬆    │Sent  │
 │▢   │Bank stmt│—         │31 May  │—         │⬆    │Recon.│
 └────┴────────┴───────────┴────────┴──────────┴─────┴──────┘
                                         ‹ 1 2 3 … ›
```

### SCR-REV-01 / SCR-REV-02 — OCR Review Queue
- **Purpose:** the signature workflow — humans confirm/correct AI extraction, accounting, VAT, and duplicate flags fast.
- **Role access:** Bookkeeper (suggest/confirm low-risk), Accountant, Senior Accountant; Reviewer read-only.
- **Layout (list, REV-01):** filter bar → confidence-sorted table → bulk action bar. **Layout (item, REV-02):** split — document viewer (left) | extracted fields + AI suggestion + duplicate banner (right) → sticky action bar.
- **Components:** FilterBar, Table + bulk-select, ConfidenceBadge, DocumentViewer (field-highlight overlay), ExtractionFieldRow, AISuggestionBlock (`why?`), VatSelector, AccountPicker, DuplicateWarning + DuplicateCompare, ReviewActionBar (sticky), keyboard hints.
- **Actions:** Filter/sort · Bulk approve (high-conf) · Open item · Edit fields · Change VAT/accounts · Approve & post · Reject · Re-run AI · Compare duplicate · keyboard A/E/R/→.
- **Filters:** type, confidence, date, counterparty, flags-only, search.
- **Tables:** `☐ · Type · Counterparty · Amount · Confidence · Flags · [Action]`.
- **Widgets:** confidence tiers (🟢🟠🔴), validation badges (✓), reasoning expander, side-by-side compare.
- **Validation:** blocking issues (net+VAT≠total, missing mandatory field) disable approval and pinpoint the field; duplicate must be resolved; corrections feed learning loop.
- **Empty:** "All caught up — nothing to review." (celebratory)
- **Loading:** skeleton rows; viewer skeleton; field placeholders.
- **Error:** "couldn't reprocess" per item + retry; OCR-failed → re-run; unreadable file.
- **Mobile:** MobileReviewCard — viewer top, fields below, swipe-approve high-confidence; tap for full.
- **Navigation:** ← Upload/Archive; → posted entry in Ledger; → Document Detail.

```
 (REV-01 list)
 Review Queue                  12 to review · 3 low confidence
 [All ▾][Type ▾][Confidence ▾][Date ▾][Counterparty ▾] 🔍
 ┌──┬────────┬───────────┬───────┬───────┬───────┬─────────┐
 │☐ │Type    │Counterpty │Amount │Conf.  │Flags  │Action   │
 │☐ │Purchase│Supplier X │€240   │96% 🟢 │—      │[Approve]│
 │☐ │Purchase│Supplier Y │€1,180 │62% 🟠 │Net≠Sum│[Review] │
 │☐ │Purchase│Supplier X │€240   │91% 🟢 │⧉ Dup? │[Review] │
 └──┴────────┴───────────┴───────┴───────┴───────┴─────────┘
 [☑ Select all 🟢]  [Bulk approve (8)]        sort: conf ▾

 (REV-02 single item)
 ┌────────────────────┬────────────────────────────────────┐
 │ DOCUMENT           │ EXTRACTED DATA          Confidence  │
 │ ┌────────────────┐ │ Supplier  Supplier X    🟢 98%      │
 │ │  invoice image │ │ VAT no.   BG123456789   ✓ validated │
 │ │  w/ field      │ │ EIK       123456789     ✓           │
 │ │  highlights    │ │ Invoice#  INV-552       🟢 97%      │
 │ │                │ │ Net       €200.00       🟠 84%      │
 │ └────────────────┘ │ VAT 20%   €40.00        🟢          │
 │ ◀ page 1/1 ▶       │ Total     €240.00       ✓ =net+VAT  │
 ├────────────────────┴────────────────────────────────────┤
 │ AI SUGGESTION                                   why? ⓘ   │
 │  Dr 601 Materials 200 · Dr 4531 VAT 40 · Cr 401 240      │
 │  VAT: Standard 20% deductible           [change ▾]       │
 ├──────────────────────────────────────────────────────────┤
 │ ⧉ POSSIBLE DUPLICATE: #552 posted 21 May      [Compare]  │
 ├──────────────────────────────────────────────────────────┤
 │ [Reject]   [Edit fields]          [Approve & post ✔]     │
 └──────────────────────────────────────────────────────────┘
```

### SCR-DOC-04 — Document Detail Screen
- **Purpose:** inspect one document end-to-end — original, extraction, linked posting, versions, audit lineage.
- **Role access:** Bookkeeper+ (edit), Reviewer/Auditor (read), Client User (own, read).
- **Layout:** split — DocumentViewer (left) | tabbed right panel (Fields · Posting · Versions · Audit) → action bar.
- **Components:** DocumentViewer, ExtractionFieldRow list, linked JournalEntry preview, version-history Table, AuditEventRow list, DuplicateWarning, action bar, ConfidenceBadge/ValidationBadge.
- **Actions:** Edit · Re-run AI · Post/approve · Mark duplicate · Download original · Delete (guarded) · View linked entry · Restore version.
- **Filters:** none (tabs).
- **Tables:** version history `version · who · when · change`; line items (if invoice).
- **Widgets:** field-highlight link to viewer; lineage chain (source → derived); audit snippet.
- **Validation:** edits re-validate (EIK/VAT/IBAN/arithmetic); delete blocked if posted/locked (use reversal); period-lock respected.
- **Empty:** n/a (always has a document).
- **Loading:** viewer + panel skeletons.
- **Error:** OCR failed (re-run); file unreadable (download); validation errors highlighted on fields.
- **Mobile:** stacked (viewer top, tabs below); actions in bottom sheet.
- **Navigation:** ← Archive/Review; → linked Ledger entry; → Audit Trail.

```
 Documents ▸ invoice INV-552
 ┌────────────────────┬────────────────────────────────────┐
 │ DOCUMENT VIEWER    │ [Fields][Posting][Versions][Audit]  │
 │ ┌────────────────┐ │ Supplier X · BG123… ✓               │
 │ │  zoom / pan    │ │ Net €200 · VAT €40 · Total €240 ✓   │
 │ │  field         │ │ Linked entry #220  [open]           │
 │ │  highlights    │ │ Lineage: upload → extract → post    │
 │ └────────────────┘ │ Versions: v2 (edited by M.) …       │
 │ ◀ 1/1 ▶  [Download]│                                     │
 ├────────────────────┴────────────────────────────────────┤
 │ [Re-run AI] [Edit] [Mark duplicate]   [Approve & post ✔] │
 └──────────────────────────────────────────────────────────┘
```

---

# INVOICING

All four document builders share one layout (header → line table → totals → action bar) with type-specific rules. Listed first is the shared builder; variants note only differences.

### SCR-INV-02 — Create Invoice
- **Purpose:** create, preview, issue, and email a compliant sales invoice (dual-currency, multi-language).
- **Role access:** Accountant, Senior Accountant, Account Owner.
- **Layout:** header (type/series/number, language, currency) → customer + dates → InvoiceLineTable → notes + TotalsPanel → sticky action bar; live preview toggle.
- **Components:** DocumentTypeHeader, CustomerSelect (VIES badge), DatePicker ×3, InvoiceLineTable, VatSelector, MoneyField, TotalsPanel (DualCurrencyAmount), InvoicePreview, InvoiceActionBar.
- **Actions:** Pick customer · Add/remove/reorder lines · Pick catalogue items · Set VAT per line · Save draft · Preview · Issue · Issue & email · Duplicate.
- **Filters:** catalogue autocomplete (not page filters).
- **Tables:** line items — `# · item · qty · unit € · VAT% · net € · line total €`.
- **Widgets:** live preview in selected language; dual EUR/BGN totals; auto reverse-charge/intra-EU note from customer status; sequential numbering display.
- **Validation:** mandatory Bulgarian invoice fields before issue; VIES-invalid VAT (warn + override-with-reason); numbering-gap warning; line math; supply/issue date rules.
- **Empty:** "Add a customer and your first line."
- **Loading:** customer/catalogue async; preview render skeleton; issue spinner.
- **Error:** missing mandatory field (blocks issue, highlights); email-send failed (issued-but-not-sent → retry); VIES timeout.
- **Mobile:** QuickInvoice (recent customer + 1 line + issue/share); full builder available but condensed.
- **Navigation:** ← Invoice List; → preview/PDF; → Receivables (creates receivable); → Customer Detail.

```
 New Invoice                            Series INV · No. 0143
 Language [BG ▾]   Currency EUR (BGN shown)
 ┌───────────────────────────┬───────────────────────────────┐
 │ CUSTOMER                  │ DATES                         │
 │ [Search customer…] ✓VIES  │ Issue 02.06  Due 16.06  Supply│
 │ EIK 123… VAT BG123…       │                               │
 ├───────────────────────────┴───────────────────────────────┤
 │ LINE ITEMS                                  [+ Add line]   │
 │ # │ Item       │Qty│Unit €│VAT%│Net €  │Line total €      │
 │ 1 │ Consulting │10 │50.00 │20  │500.00 │600.00            │
 │ 2 │ [catalogue ▾] …                                       │
 ├────────────────────────────────────────────────────────────┤
 │ Notes […]                  Net €500 · VAT 20% €100         │
 │                            TOTAL €600  ≈ BGN 1,173.50      │
 ├────────────────────────────────────────────────────────────┤
 │ [Save draft] [Preview]        [Issue]  [Issue & email]     │
 └────────────────────────────────────────────────────────────┘
```

### SCR-INV-03 — Create Credit Note
- **Differences:** requires `ReferenceSelector` (search original invoice to credit); amounts default to negative/return; **reason field required**; posting reverses proportionally; type badge "Credit note".
- **Validation:** cannot credit more than original; referencing a filed/locked period → controlled-correction path; reason mandatory.
- **Wireframe:** same as INV-02 with a top "Crediting invoice #___ [search]" row and a required Reason field above totals.

### SCR-INV-04 — Create Debit Note
- **Differences:** references an original invoice and **adds** (extra charge/price increase); reason required; same VAT logic; type badge "Debit note".
- **Validation:** valid reference; period-lock; reason mandatory.
- **Wireframe:** same as INV-02 with "Debiting invoice #___ [search]" reference row + Reason.

### SCR-INV-05 — Proforma Invoice
- **Differences:** **no ledger/VAT posting**; clearly badged "Proforma — not a tax document"; one-tap **Convert to invoice** (carries lines, assigns real number).
- **Validation:** convert blocked if customer/VAT invalid; otherwise minimal.
- **Empty/Error:** as builder; "Proforma" badge persistent.
- **Wireframe:** same builder; action bar shows `[Save] [Preview] [Convert to invoice]`; persistent info banner "Proforma — not a tax document".

### SCR-SAL-01 — Invoice List
- **Purpose:** manage all sales documents; track status and payment.
- **Role access:** Accountant+, Read-only Viewer, Account Owner.
- **Layout:** filter bar → invoice table → bulk action bar → pagination; `+ New invoice` top-right.
- **Components:** FilterBar, Table, InvoiceStatusChip, DualCurrencyAmount, aging hint, bulk action bar.
- **Actions:** New invoice · Open · Send/resend · Duplicate · Credit · Export · Bulk send/export · Record payment.
- **Filters:** status (draft/issued/sent/paid/overdue), customer, date, amount, paid/unpaid, series, search.
- **Tables:** `number · customer · issue · due · amount(€/≈BGN) · status`.
- **Widgets:** status chips; overdue aging; quick "record payment".
- **Validation:** bulk-action permissions; resend requires issued.
- **Empty:** "Create your first invoice."
- **Loading:** skeleton rows.
- **Error:** send-failed inline; export-failed toast.
- **Mobile:** list rows → tap detail; filters in sheet; FAB for new.
- **Navigation:** → Invoice builder (new/edit) · Customer Detail · Receivables.

```
 Invoices                                       [+ New invoice]
 [Status ▾][Customer ▾][Date ▾][Amount ▾][Paid? ▾] 🔍
 ┌──────────┬───────────┬───────┬───────┬──────────┬─────────┐
 │Number    │Customer   │Issue  │Due    │Amount    │Status   │
 │INV-0143  │Customer Z │02 Jun │16 Jun │€600 ≈BGN │Sent     │
 │INV-0142  │Beta EOOD  │28 May │11 Jun │€1,200    │Overdue ⚠│
 │INV-0141  │Acme OOD   │20 May │03 Jun │€480      │Paid ✓   │
 └──────────┴───────────┴───────┴───────┴──────────┴─────────┘
```

---

# ACCOUNTING

Module-wide: a global **period selector** and **Simple ⇄ Expert** view toggle; every figure drills to its entry → source document.

### SCR-ACC-01 — Journal Entries
- **Purpose:** view, create, and reverse double-entry journal entries.
- **Role access:** Accountant, Senior Accountant (create/edit); Bookkeeper (suggest); Reviewer read.
- **Layout:** filter bar → journal table → entry detail slide-over / JournalEntryEditor modal.
- **Components:** FilterBar, Table, JournalEntryEditor (AccountPicker, MoneyField, BalanceIndicator), StatusChip, action menu.
- **Actions:** New manual entry · Open · Edit (if unlocked) · Reverse · Duplicate · Attach source · Post.
- **Filters:** date, account, status (draft/posted/reversed), source (AI/manual/import), amount.
- **Tables:** `date · entry no. · description · debit account · credit account · amount · source · status`.
- **Widgets:** balance indicator (must balance to post); source badge (AI/manual); linked document chip.
- **Validation:** entry must balance (Dr=Cr) to post; period-lock blocks edits (→ reversal); account validity.
- **Empty:** "Entries appear here as documents are posted — or add a manual entry."
- **Loading:** skeleton rows; editor skeleton.
- **Error:** unbalanced-entry block (shows the difference); locked-period notice.
- **Mobile:** read list; manual entry on desktop (complex).
- **Navigation:** → Document Detail (source) · General Ledger (account) · Audit.

```
 Journal Entries                              [+ Manual entry]
 [Date ▾][Account ▾][Status ▾][Source ▾]
 ┌────────┬──────┬─────────────┬──────────┬──────────┬──────┐
 │Date    │No.   │Description  │Debit acct│Credit    │Amount│
 │03 May  │#220  │Supplier X   │601       │401       │€240  │
 │11 May  │#231  │Supplier Y   │601       │401       │€1,180│
 └────────┴──────┴─────────────┴──────────┴──────────┴──────┘
 (editor) Dr [601 Materials ▾] 200.00  Cr [401 ▾] 240.00 …
          Balance ✓                      [Post entry]
```

### SCR-ACC-02 — General Ledger
- **Purpose:** see all movements and running balance for an account over a period.
- **Role access:** Accountant+, Reviewer, Account Owner.
- **Layout:** account + period header + view toggle → ledger table with running balance → export.
- **Components:** AccountPicker, PeriodPicker, view toggle, LedgerTable (sticky header, totals row), Export menu.
- **Actions:** Choose account · Set period · Drill to entry/source · Export · Print · Switch Simple/Expert.
- **Filters:** account, date, source, counterparty, amount.
- **Tables:** `date · entry/desc · source · debit € · credit € · balance €` + opening/closing rows.
- **Widgets:** running balance; opening/closing emphasis; drill-down.
- **Validation:** read-only; flags if any entry unbalanced.
- **Empty:** "No movements in this period."
- **Loading:** skeleton rows.
- **Error:** load banner + retry.
- **Mobile:** horizontal scroll or condensed columns; tap row → detail.
- **Navigation:** → Journal entry → Document Detail; ← Trial Balance / Chart of Accounts.

```
 General Ledger   Account [601 Materials ▾]  Period May 2026 ▾
 View: ◉Expert ○Simple                       [Export ▾][Print]
 ┌────────┬─────────────┬───────┬────────┬────────┬──────────┐
 │Date    │Entry / Desc │Source │Debit € │Credit €│Balance € │
 │Opening │             │       │        │        │1,200.00  │
 │03 May  │#220 Suppl X │doc#88 │200.00  │        │1,400.00  │
 │11 May  │#231 Suppl Y │doc#91 │980.00  │        │2,380.00  │
 │Closing │             │       │1,180.00│0.00    │2,380.00  │
 └────────┴─────────────┴───────┴────────┴────────┴──────────┘
```

### SCR-ACC-03 — Trial Balance
- **Purpose:** verify the books balance as of a date; jump-off to investigate.
- **Role access:** Accountant+, Reviewer, Account Owner.
- **Layout:** as-of header + compare control → trial-balance table → balanced indicator footer.
- **Components:** date/PeriodPicker, compare selector (prior period/year), Table (debit/credit + BGN ref), BalanceIndicator, Export.
- **Actions:** Set as-of · Compare · Drill to ledger · Export.
- **Filters:** as-of date, account class, active-only, compare.
- **Tables:** `account · name · debit € · credit € · (BGN ref)` + totals row (must balance).
- **Widgets:** prominent balanced ✓/✗; comparatives handling the EUR/BGN changeover.
- **Validation:** read-only; highlight imbalance.
- **Empty:** "No data for this period."
- **Loading:** skeleton.
- **Error:** load banner.
- **Mobile:** condensed columns; balanced indicator pinned.
- **Navigation:** → General Ledger (account) · Reports.

```
 Trial Balance   As of 31 May 2026   [Compare to ▾][Export]
 ┌────────┬────────────────┬──────────┬──────────┐
 │Account │Name            │Debit €   │Credit €  │
 │501     │Cash            │3,200.00  │          │
 │601     │Materials       │2,380.00  │          │
 │411     │Customers       │8,120.00  │          │
 │401     │Suppliers       │          │3,540.00  │
 ├────────┴────────────────┼──────────┼──────────┤
 │ TOTALS (Balanced ✓)     │18,420.00 │18,420.00 │
 └─────────────────────────┴──────────┴──────────┘
```

### SCR-ACC-04 — Chart of Accounts
- **Purpose:** view/manage the Bulgarian national chart of accounts (classes 1–7).
- **Role access:** Senior Accountant, Account Owner (edit); others read.
- **Layout:** class-grouped tree (left) + account detail (right) → add/edit.
- **Components:** account tree (expand by class), search, AccountPicker-style detail form, active toggle, mapping field (for SAF-T later), action menu.
- **Actions:** Add account · Edit · Activate/deactivate · Map · Search · Expand class.
- **Filters:** class (1–7), active/inactive, search by code/name.
- **Tables:** tree rows `code — name · type · balance · active`.
- **Widgets:** class grouping; usage indicator (used → can't delete); normal-balance hint.
- **Validation:** unique code; cannot delete a used account (deactivate instead); type required.
- **Empty:** offer to load default BG CoA.
- **Loading:** tree skeleton.
- **Error:** "cannot delete used account" with reason; save validation.
- **Mobile:** collapsible tree; detail in sheet.
- **Navigation:** → General Ledger (from account) · Settings (CoA basis).

```
 Chart of Accounts                 [+ Add account] 🔍
 ┌─────────────────────────────┬───────────────────────────┐
 │ ▸ Class 1 Capital           │ 601 — Materials           │
 │ ▾ Class 6 Expenses          │ Type: Expense             │
 │     601 Materials  (used)   │ Normal balance: Debit     │
 │     602 External services   │ Active ☑                  │
 │ ▸ Class 7 Revenue           │ Used in 142 entries       │
 └─────────────────────────────┴───────────────────────────┘
```

---

# VAT

Module-wide: a global **VAT period selector** (monthly, filing by the 14th) and a validation chip that links to fixes.

### SCR-VAT-01 — Purchase Ledger (Дневник на покупките)
- **Purpose:** the period's purchase VAT register, derived from approved postings.
- **Role access:** Accountant+, Reviewer, Account Owner.
- **Layout:** period header + validation chip → ledger table → export.
- **Components:** PeriodPicker, validation chip, VatLedgerTable, VAT-rate tag, Export menu, fix links.
- **Actions:** Set period · Open source doc · Fix flagged row · Export · (feeds VAT Return).
- **Filters:** type (Std/Reduced/RC/Intra-EU/Exempt), supplier, VAT rate, date, flagged-only.
- **Tables:** `№ · doc no. · supplier · VAT no. · net € · VAT € · total € · type`.
- **Widgets:** type tags; per-row validation chips; reverse-charge note.
- **Validation:** missing VAT, duplicate, RC-self-charge presence; chips link to fixes; read-only register (fix at source).
- **Empty:** "No purchases recorded for this period."
- **Loading:** skeleton rows.
- **Error:** per-row validation; load banner.
- **Mobile:** condensed; tap row → source.
- **Navigation:** → Document/Entry (source) · VAT Return.

```
 Purchase Ledger (Дневник на покупките)   Period May 2026 ▾
 Validation: 1 warning ⚠                              [Export ▾]
 ┌──┬────────┬─────────┬────────┬───────┬──────┬───────┬─────┐
 │№ │Doc no. │Supplier │VAT no. │Net €  │VAT € │Total €│Type │
 │1 │INV-552 │Suppl X  │BG123…  │200.00 │40.00 │240.00 │Std  │
 │2 │INV-impt│EU Vendor│DE…     │500.00 │ —    │500.00 │RC   │
 └──┴────────┴─────────┴────────┴───────┴──────┴───────┴─────┘
 ⚠ Row 2: reverse-charge — ensure self-charged VAT entry [Fix]
```

### SCR-VAT-02 — Sales Ledger (Дневник на продажбите)
- **Differences from Purchase Ledger:** customer-side register; columns `№ · doc no. · customer · VAT no. · net · VAT · total · type`; validations focus on output VAT, intra-EU supplies, and VIES consistency.
- All other fields (role, states, mobile, navigation) mirror SCR-VAT-01.

### SCR-VAT-03 — VAT Return
- **Purpose:** assemble, validate, explain, approve, sign, and file the period's VAT return.
- **Role access:** prepare — Accountant; approve/sign/file — Senior Accountant/Approver (preparer ≠ approver if firm policy).
- **Layout:** SubmissionStepper (Prepare→Validate→Approve→Sign→Submit→Done) → return summary + ValidationPanel + AISummaryCard → commit bar.
- **Components:** SubmissionStepper, return summary (boxes/totals), ValidationPanel, AISummaryCard, CommitConfirmation, KepSignPanel (handoff), DualCurrencyAmount.
- **Actions:** Assemble · Validate · Fix issues · Submit for approval · Approve · Sign (KEP) · Generate files · Submit/assist · Lock period.
- **Filters:** period.
- **Tables:** return-box summary; underlying ledger links.
- **Widgets:** net VAT payable/refundable figure; validation summary; AI plain-language read; commit confirmation.
- **Validation:** blocking errors prevent advance; warnings require acknowledgment; KEP + Approver required to file; period lock on completion.
- **Empty:** "No open period to file."
- **Loading:** assembly + validation spinners; generation progress.
- **Error:** itemized validation failures (deep links); submission failure keeps signed file + retry (never silent success).
- **Mobile:** review + approve possible; signing/filing → desktop (can initiate).
- **Navigation:** ← VAT ledgers; → KEP (SCR-KEP-01) · NAP (SCR-NAP-01) · Compliance dashboard · Audit.

```
 VAT Return — May 2026
 ①Prepare ✓ → ②Validate ● → ③Approve → ④Sign → ⑤Submit → ⑥Done
 ┌────────────────────────────────────────────────────────────┐
 │ Output VAT (sales)        €2,000                            │
 │ Input VAT (purchases)     €  740  (deductible)              │
 │ NET VAT PAYABLE           €1,260   ≈ BGN 2,464.34           │
 │ Validation: ✓ 0 errors · ⚠ 2 warnings        [Review][Fix] │
 │ AI: "Two reverse-charge items verified. Payable €1,260."    │
 ├────────────────────────────────────────────────────────────┤
 │ [Submit for approval]                  (→ Approve → Sign)    │
 └────────────────────────────────────────────────────────────┘
```

### SCR-VAT-04 — VAT Validation Center
- **Purpose:** a single place to run and resolve all VAT-related validations before filing — numbers, duplicates, consistency, VIES.
- **Role access:** Accountant+, Senior Accountant.
- **Layout:** validation summary tiles (by category) → issue list table → resolve drawer.
- **Components:** category tiles (VAT numbers · Missing VAT · Duplicates · VIES · RC consistency), issue Table, ValidationBadge, resolve slide-over, re-run button, ConfidenceBadge where AI-flagged.
- **Actions:** Run checks · Filter by category · Open/resolve issue · Re-validate · Bulk dismiss (with reason) · Validate VAT number/VIES.
- **Filters:** category, severity (error/warning), counterparty, status (open/resolved), period.
- **Tables:** `severity · category · counterparty/doc · issue · suggested fix · status`.
- **Widgets:** category summary tiles with counts; VIES live check; severity coloring.
- **Validation:** errors block VAT Return advance; resolutions logged to audit; dismiss requires reason.
- **Empty:** "All VAT checks pass for this period ✓."
- **Loading:** running-checks progress; per-row recheck spinner.
- **Error:** VIES/service down → retry, allow manual mark; recheck failures.
- **Mobile:** category tiles + list; resolve in sheet.
- **Navigation:** → VAT Return (gated by this) · Document/Entry · Customer/Supplier.

```
 VAT Validation Center                    Period May 2026 ▾
 ┌──────────┬───────────┬───────────┬─────────┬───────────┐
 │VAT numbers│Missing VAT│Duplicates │VIES     │RC consist.│
 │ ✓ 0      │ ⚠ 1       │ ⚠ 2       │ ✓ valid │ ⚠ 1       │
 └──────────┴───────────┴───────────┴─────────┴───────────┘
 ISSUES (4)            [Filter ▾]                  [Re-run]
 ┌────────┬───────────┬───────────────┬──────────┬─────────┐
 │Severity│Category   │Doc / party    │Suggested │Status   │
 │⚠ Warn  │Duplicate  │INV-552 (×2)   │Merge     │Open     │
 │! Error │Missing VAT│Supplier Y     │Add VAT   │Open     │
 └────────┴───────────┴───────────────┴──────────┴─────────┘
```

---

# BANKING

### SCR-BNK-01 — Bank Transactions
- **Purpose:** view imported bank transactions per account and their reconciliation status.
- **Role access:** Accountant+, Reviewer, Account Owner.
- **Layout:** account selector + import action → transactions table → reconciliation status chips.
- **Components:** account selector, Import button (→ SCR-BNK-02), Table, StatusChip (reconciled/unmatched), DualCurrencyAmount, FilterBar.
- **Actions:** Select account · Import statement · Open transaction · Go to reconciliation · Create entry · Export.
- **Filters:** account, matched/unmatched, date, amount, direction (in/out), search.
- **Tables:** `date · description · counterparty · amount(€) · direction · status`.
- **Widgets:** balance summary; unreconciled count; import history.
- **Validation:** import format (MT940/CAMT.053/CSV/XLSX); duplicate-import warning.
- **Empty:** "Add a bank account / import a statement to start."
- **Loading:** skeleton rows; import progress.
- **Error:** unsupported/garbled file; duplicate import; connection error (PSD2 phase 2).
- **Mobile:** list view; reconciliation → desktop.
- **Navigation:** → Reconciliation Workspace (SCR-BNK-03) · Import · Journal entry.

```
 Banking ▸ Transactions   Account [UniCredit …4521 ▾]  [Import]
 [Status ▾][Date ▾][Direction ▾][Amount ▾] 🔍
 ┌────────┬────────────────┬───────────┬────────┬───────────┐
 │Date    │Description     │Counterpty │Amount €│Status     │
 │02 Jun  │Card POS …      │Supplier X │-240.00 │Unmatched ⚠│
 │31 May  │Incoming transfer│Customer Z │+560.00 │Reconciled✓│
 └────────┴────────────────┴───────────┴────────┴───────────┘
              Unreconciled: 4              [Reconcile →]
```

### SCR-BNK-03 — Reconciliation Workspace
- **Purpose:** match bank transactions to invoices/entries and reach "reconciled" fast.
- **Role access:** Accountant+, Senior Accountant.
- **Layout:** two-column match board — bank transactions (left) ↔ suggested matches (right) → center match action → splitter for partials → progress.
- **Components:** ReconciliationBoard, MatchSplitter (partials/fees/FX), auto-match ConfidenceBadge, candidate list, BalanceIndicator, action bar, progress meter.
- **Actions:** Accept match · Reject/choose alternative · Split (partial) · Handle fee/FX · Create entry · Reconcile · Undo · Auto-reconcile confident.
- **Filters:** matched/unmatched, date, amount, account.
- **Tables:** transactions list; candidate matches list.
- **Widgets:** match confidence; partial-payment splitter; fee/FX handler; "N of M reconciled" progress.
- **Validation:** ambiguous match requires explicit choice; FX rounding flag; over/under-match prevented.
- **Empty:** "Import a statement to begin reconciling."
- **Loading:** auto-match spinner; board skeleton.
- **Error:** ambiguous-match prompt; FX-rounding warning; unmatched remainder reminder.
- **Mobile:** simplified accept/reject of suggested matches; complex splits → desktop.
- **Navigation:** ← Bank Transactions; → Invoice/Entry (matched); → Journal (created entry).

```
 Reconciliation — UniCredit …4521          12 of 28 reconciled
 ┌───────────────────────────┬───────────────────────────────┐
 │ BANK TRANSACTIONS         │ SUGGESTED MATCH               │
 │ 02 Jun  -€240  Supplier X │ ▶ INV-552  €240  91% 🟢       │
 │ ───────────────────────── │   [Accept]  [Choose another]  │
 │ 31 May  +€560  Customer Z │ ▶ INV-0143 €600  partial?     │
 │                           │   [Split]  [Create entry]     │
 └───────────────────────────┴───────────────────────────────┘
        [Auto-reconcile confident]            [Undo]
```

---

# AI

Three AI surfaces share one engine but differ in stance: **AI Accountant** (transactional/compliance Q&A), **AI CFO** (forward-looking financial advisory), **AI Recommendations Center** (the consolidated feed of all AI proposals/risks). All three: cite sources, label guidance, and **cannot file/approve/sign**.

### SCR-AI-01 — AI Accountant
- **Purpose:** grounded conversational help on VAT, accounting, and financial questions; explains entries and obligations; cites the company's own data and tax rules.
- **Role access:** all company roles (answers scoped to their permissions); Client User gets a simplified variant.
- **Layout:** right slide-over panel (context header → message thread → composer) + full-page variant.
- **Components:** AiPanel, AiMessage (user/assistant), SourceCitation chips, SuggestedActionChips, GuidanceNote, AiQuickPrompts, AiComposer (streaming).
- **Actions:** Ask · Tap quick prompt · Open a cited source · Tap a suggested action (deep-link) · Expand explanation · Switch language · Open full page.
- **Filters:** none (conversational); context derived from current screen.
- **Tables:** none (figures rendered inline, tabular).
- **Widgets:** context header ("Context: VAT return · May 2026"); citations; action chips; streaming indicator.
- **Validation:** never fabricates figures (ledger-sourced); low-confidence → "verify with your accountant"; refuses to file/sign.
- **Empty:** greeting + example questions tailored to the screen.
- **Loading:** streaming dots.
- **Error:** "Couldn't reach the assistant — your data is unaffected," retry; core app unaffected.
- **Mobile:** full-screen chat; quick prompts; large composer.
- **Navigation:** deep-links into VAT Return, Invoices, Reconciliation, Reports; opens cited documents/ledgers.

```
 AI Accountant                                     ✕
 Context: VAT return · May 2026
 ─────────────────────────────────────────────────
 You: How much VAT do I owe?
 AI:  For May 2026 you owe €1,260, due 14 June.
      Sales VAT €2,000 − deductible €740.
      ▸ Sources: Sales ledger [open] · Purchase
        ledger [open] · ЗДДС art. … [view]
      ⚠ Guidance — you decide & approve before filing.
      [Open VAT return] [Explain the calculation]
 ─────────────────────────────────────────────────
 [Ask something…                               ➤ ]
 Quick: VAT? · Deadlines? · P&L?
```

### SCR-AI-02 — AI CFO
- **Purpose:** forward-looking financial advisory — cash-flow outlook, profitability, runway, trends, scenario questions — for owners and firms advising clients.
- **Role access:** Account Owner, Senior Accountant; firm principals (per client). Not Client User by default.
- **Layout:** dashboard-style insight canvas (top: health/cash-flow cards & mini-charts) + advisory chat panel (right); insight cards link to detail.
- **Components:** insight cards (cash-flow forecast, profitability trend, runway, top cost drivers), mini charts, AiMessage thread, SourceCitation, SuggestedActionChips, scenario input ("what if…"), GuidanceNote.
- **Actions:** Ask forward-looking questions · Run scenario · Open insight detail · Export insight · Tap action chip · Share to report.
- **Filters:** period/horizon (3/6/12-month outlook), comparison basis.
- **Tables:** supporting figures behind each insight (drill-down).
- **Widgets:** forecast charts; KPI trends; scenario sandbox; alert cards (e.g. "cash dips below €X in 6 weeks").
- **Validation:** projections labeled as estimates with assumptions shown; sourced from ledger/history; never presented as certainty; no advice that constitutes regulated financial advice without disclaimer.
- **Empty:** "Not enough history yet — insights improve as data accumulates."
- **Loading:** chart skeletons; streaming chat.
- **Error:** insufficient-data notice; assistant-unavailable (data unaffected).
- **Mobile:** stacked insight cards + chat; charts simplified.
- **Navigation:** → Reports (Management) · Receivables/Payables · Banking; share insight → report.

```
 AI CFO                                   Outlook: 6 months ▾
 ┌───────────────┬───────────────┬───────────────────────┐
 │CASH FORECAST  │PROFITABILITY  │RUNWAY                 │
 │ ▁▂▃▅▅▇ ↗      │ margin 18% ▲  │ ~9 months             │
 │ ⚠ dips wk 6   │               │                       │
 └───────────────┴───────────────┴───────────────────────┘
 TOP COST DRIVERS: Materials 42% · Services 23% …
 ─────────────────────────────────────────────────────────
 You: What if revenue drops 15% next quarter?
 AI:  Cash would dip below €5k by late August. Key lever:
      defer €X payables. ▸ Sources: P&L, AR aging [open]
      (estimate — assumptions shown) [Run scenario]
```

### SCR-AI-03 — AI Recommendations Center
- **Purpose:** a single consolidated feed of every AI proposal across the company — postings to review, risks/anomalies, duplicates, VAT issues, optimizations — prioritized.
- **Role access:** Accountant+, Senior Accountant, Account Owner; firm cross-client variant.
- **Layout:** category tabs/filters → prioritized recommendation cards/list → action on each → bulk actions.
- **Components:** category filter, RecommendationCard (type · summary · why · confidence · impact · action), ConfidenceBadge, bulk action bar, dismiss-with-reason.
- **Actions:** Accept/apply (deep-link to the relevant flow) · Dismiss (reason) · Snooze · Open detail · Bulk accept high-confidence · Filter by category.
- **Filters:** category (review/risk/duplicate/VAT/optimization), confidence, impact, status (open/dismissed/done), date.
- **Tables:** list of recommendations (card or row): `type · summary · confidence · impact · [action]`.
- **Widgets:** priority sort (impact × confidence); category counts; learning note ("dismissing teaches the AI").
- **Validation:** applying routes through the proper human-in-the-loop flow (never auto-commits state actions); dismiss logged to audit.
- **Empty:** "No recommendations right now — you're in good shape ✓."
- **Loading:** skeleton cards.
- **Error:** per-card apply error + retry.
- **Mobile:** stacked cards; swipe accept/dismiss for low-risk.
- **Navigation:** each recommendation → Review Queue / VAT Validation / Reconciliation / Invoice etc.

```
 AI Recommendations                 [All][Risk][VAT][Optimize]
 ┌──────────────────────────────────────────────────────────┐
 │ ⚠ RISK · Unusual amount on Supplier X invoice   conf 88%  │
 │   €1,180 vs avg €240. why? ⓘ        [Open] [Dismiss ▾]    │
 ├──────────────────────────────────────────────────────────┤
 │ ⧉ DUPLICATE · INV-552 appears twice              conf 91% │
 │   [Compare & resolve] [Dismiss ▾]                         │
 ├──────────────────────────────────────────────────────────┤
 │ ✦ OPTIMIZE · 3 expenses missing VAT deduction             │
 │   Potential €X reclaim   [Review] [Dismiss ▾]             │
 └──────────────────────────────────────────────────────────┘
 [Bulk accept high-confidence]
```

---

# NAP

### SCR-NAP-01 — Submission Center
- **Purpose:** the hub for all NAP submissions — status, history, and starting a filing.
- **Role access:** Senior Accountant/Approver, Account Owner; Accountant (prepare).
- **Layout:** status cards (current obligations) → submission history table → "Start filing" actions.
- **Components:** ComplianceStatusCard ×N (VAT return, VIES, SAF-T*), SubmissionHistoryRow table, StatusChip, Button (Start filing), SAF-T not-in-scope note.
- **Actions:** Start VAT filing · Start VIES · (SAF-T phase 2) · Open past submission · Download confirmation · Re-file/correct.
- **Filters:** type (VAT/VIES/SAF-T), period, status, year.
- **Tables:** history — `period · type · status · signed-by · confirmation [View][Download]`.
- **Widgets:** obligation status cards; next-deadline; SAF-T scope note ("from 2026 for large enterprises, widening by ~2030").
- **Validation:** start-filing gated by VAT Validation Center pass + KEP configured + Approver role.
- **Empty:** "No submissions yet."
- **Loading:** skeleton cards/rows.
- **Error:** clearly distinguishes "not filed" from "filed"; failed submission retains artifacts.
- **Mobile:** status cards + history; filing → desktop.
- **Navigation:** → Filing Workflow (SCR-NAP-02) · VAT Return · KEP · Compliance dashboard.

```
 NAP Submission Center
 ┌───────────────┬───────────────┬───────────────────────┐
 │VAT — May 2026 │VIES — May     │SAF-T                  │
 │Ready to file  │Ready          │Not in scope*          │
 │[Start filing] │[Start]        │[Learn more]           │
 └───────────────┴───────────────┴───────────────────────┘
 SUBMISSION HISTORY
 ┌──────────┬───────────┬────────┬──────────┬────────────────┐
 │Period    │Type       │Status  │Signed by │Confirmation    │
 │Apr 2026  │VAT return │Filed ✓ │M.Petrova │[View][Download]│
 │Apr 2026  │VIES       │Filed ✓ │M.Petrova │[View]          │
 └──────────┴───────────┴────────┴──────────┴────────────────┘
 *SAF-T: from 2026 for large enterprises, widening by ~2030.
```

### SCR-NAP-02 — Filing Workflow
- **Purpose:** the gated, step-by-step act of filing a submission to NAP (validate → approve → sign → generate → submit → confirm).
- **Role access:** Approver/Senior Accountant (advance/commit); Accountant (prepare); Reviewer (observe).
- **Layout:** SubmissionStepper (full-width) → step content (validation/approval/sign/generate/submit) → sticky commit bar → confirmation.
- **Components:** SubmissionStepper, ValidationPanel, AISummaryCard, approval control (SoD), KepSignPanel (handoff), file-generation progress, CommitConfirmation, confirmation/receipt panel.
- **Actions:** Validate · Fix · Approve · Sign with KEP · Generate files · Submit (MVP: download + guided portal upload; later: direct) · Lock period · Download confirmation.
- **Filters:** none.
- **Tables:** generated-files list; validation issues.
- **Widgets:** gated stepper; commit confirmation summary ("Filing May 2026 VAT — €1,260 payable; locks period"); progress; receipt.
- **Validation:** blocking errors stop progression; warnings acknowledged; preparer ≠ approver (policy); KEP + Approver required; idempotent (no double-file).
- **Empty:** entered only from a ready submission.
- **Loading:** generation/submit progress with stage labels.
- **Error:** validation deep links; submission failure keeps signed file + retry; never silent success; clear failed end-state to audit.
- **Mobile:** review/approve; signing/submit → desktop (initiate only).
- **Navigation:** ← Submission Center / VAT Return; → KEP Signature Workflow; → Compliance dashboard · Audit.

```
 Filing — VAT Return May 2026
 ①Validate ✓ → ②Approve ✓ → ③Sign ● → ④Generate → ⑤Submit → ⑥Done
 ┌────────────────────────────────────────────────────────────┐
 │ Ready to sign:  VAT return May 2026 (hash 0xAB…)            │
 │ Approved by: M. Petrova · 14:18                             │
 │ AI: "Payable €1,260. Validations passed."                   │
 │                                   [ Sign with KEP ] (commit) │
 │ ── on submit ──  CONFIRM: Filing May 2026 — €1,260 payable. │
 │                  This locks the period. [Cancel][Confirm&file]│
 └────────────────────────────────────────────────────────────┘
```

---

# KEP

### SCR-KEP-01 — Signature Workflow
- **Purpose:** sign a submission/document with a qualified e-signature — never blind, never holding keys.
- **Role access:** Approver/Senior Accountant, Account Owner (whoever signs per policy).
- **Layout:** what's-being-signed panel → method + provider → phase stepper → result.
- **Components:** signed-artifact summary (name + hash), method selector (Cloud QES/Card-Token/Mobile), provider select, phase stepper (Prepare→Authenticate→Apply→Verify), result panel (signer/cert/timestamp), help link.
- **Actions:** Review artifact · Select method/provider · Continue with KEP · Cancel · Get help (middleware).
- **Filters:** none.
- **Tables:** none.
- **Widgets:** artifact + hash display; phase stepper; success card (signer, certificate, timestamp) → audit.
- **Validation:** certificate present/valid/not-expired/not-revoked; middleware detected (card); successful verify required.
- **Empty:** entered from a sign action.
- **Loading:** phase progress ("Authenticate…", "Applying signature…").
- **Error:** cert expired/revoked; middleware missing (install guide); user cancelled; timeout — each with recovery; partial-sign never recorded as complete.
- **Mobile:** mobile-signing path; card → desktop.
- **Navigation:** ← Filing Workflow / Document Detail; → confirmation in originating flow; → Audit Trail.

```
 Sign with KEP
 Signing: VAT return — May 2026   (hash 0xAB12…)
 Method:  ◉ Cloud QES  ○ Card/Token  ○ Mobile
 Provider:[ B-Trust ▾ ]
 ①Prepare ✓ → ②Authenticate ● → ③Apply → ④Verify
 [ Cancel ]                          [ Continue with KEP ]
 ── on success ──
 ✓ Signed by M. Petrova · cert valid to 2027 · 14:22  → audit
```

### SCR-KEP-02 — Certificate Management
- **Purpose:** manage connected KEP certificates/providers, validity, and defaults.
- **Role access:** Account Owner, Senior Accountant/Approver, Tenant Admin.
- **Layout:** connected certificates list/cards → certificate detail → add/connect.
- **Components:** certificate cards (provider · holder · validity · status), add-certificate flow (method/provider/test-sign), default selector, status badges, test-signature action.
- **Actions:** Add/connect certificate · Test signature · Set default · Disconnect (guarded) · View details · Renew reminder.
- **Filters:** provider, status (active/expiring/expired).
- **Tables:** certificates — `provider · holder · valid-from/to · status · default`.
- **Widgets:** expiry warnings (amber as it nears, red when expired); status badges; test-sign result.
- **Validation:** validity/revocation checks; disconnect warns about dependent filing features; default must be valid.
- **Empty:** "No certificates connected — connect one to sign and file."
- **Loading:** status-check spinner.
- **Error:** middleware missing; cert expired/revoked; connection failed; disconnect dependency warning.
- **Mobile:** view/manage; some connect methods → desktop.
- **Navigation:** ← Settings/KEP; → Signature Workflow; used by NAP filing.

```
 KEP — Certificate Management                    [+ Connect]
 ┌──────────────────────────────────────────────────────────┐
 │ B-Trust · M. Petrova · valid to 12.2027 · Active · Default│
 │   [Test signature] [Set default] [Details] [Disconnect]   │
 ├──────────────────────────────────────────────────────────┤
 │ Evrotrust · I. Ivanov · expires in 21 days ⚠ · Active     │
 │   [Renew reminder] …                                      │
 └──────────────────────────────────────────────────────────┘
```

---

# REPORTS

Module-wide: a **Reports Library** (cards by category) opening a shared **Report Viewer** (period/compare/export/drill-down, multi-language, schedule/share to portal). The three report types below are categories within this pattern.

### SCR-RPT-01 — Financial Reports
- **Purpose:** standard financial statements — P&L, balance sheet, cash flow.
- **Role access:** Accountant+, Account Owner, Read-only Viewer; Reviewer/Auditor.
- **Layout:** library cards (left/top) → Report Viewer (rendered statement + controls panel).
- **Components:** report cards (P&L, Balance sheet, Cash flow), Report Viewer, PeriodPicker, compare selector, Export menu (PDF/XLSX), drill-down, DualCurrencyAmount, schedule/share.
- **Actions:** Open report · Set period · Compare (prior period/year) · Drill to ledger/source · Export · Schedule · Share to client portal · Switch language.
- **Filters:** report type, period, compare basis, basis (NSS/IFRS where applicable).
- **Tables:** statement line items with figures + comparatives.
- **Widgets:** rendered statement; comparison columns; drill-down; export; EUR/BGN changeover handling in comparatives.
- **Validation:** read-only; flags if underlying data unbalanced/incomplete.
- **Empty:** "Pick a report to view."
- **Loading:** generation skeleton; progressive render.
- **Error:** generation failed → retry; incomplete-period notice.
- **Mobile:** report list → full-screen viewer; horizontal scroll for columns; export/share via sheet.
- **Navigation:** → General Ledger / Trial Balance (drill) · share → Client Portal.

```
 Reports ▸ Financial                      [Schedule][Export ▾]
 ┌───────────┬───────────┬────────────┐  Profit & Loss
 │ P&L       │ Balance   │ Cash flow  │  Period May 2026 ▾
 │ [Open]    │ [Open]    │ [Open]     │  [Compare to ▾]
 └───────────┴───────────┴────────────┘  ───────────────────
                                          Revenue      €12,400
                                          COGS         € 4,200
                                          Gross profit € 8,200
                                          … (drill to ledger)
```

### SCR-RPT-02 — Tax Reports
- **Purpose:** VAT and tax-oriented outputs — VAT summaries, purchase/sales ledger exports, VIES, (SAF-T phase 2).
- **Role access:** Accountant+, Senior Accountant, Account Owner; Reviewer.
- **Layout:** library cards → viewer with period + export + validation status.
- **Components:** report cards (VAT summary, ledgers, VIES, SAF-T*), Report Viewer, PeriodPicker, Export, validation chip, ComplianceStatusCard link.
- **Actions:** Open · Set period · Export (PDF/XLSX/XML) · Validate · Send to NAP flow · Share.
- **Filters:** report type, period, status, format.
- **Tables:** VAT summary boxes; ledger lines; VIES listing.
- **Widgets:** validation chip; link to Submission Center; SAF-T scope note.
- **Validation:** read-only; pre-file validation surfaced; export format checks.
- **Empty:** "Select a tax report."
- **Loading:** generation skeleton.
- **Error:** generation/validation failures listed; service-down for VIES.
- **Mobile:** list → viewer; export via sheet.
- **Navigation:** → VAT Return / Submission Center / VAT Validation Center.

### SCR-RPT-03 — Management Reports
- **Purpose:** decision-support reports — aging, profitability, cost breakdowns, custom; ties to AI CFO.
- **Role access:** Account Owner, Senior Accountant; firm principals; Read-only Viewer.
- **Layout:** library cards + custom-report builder entry → viewer with charts + tables.
- **Components:** report cards (AR/AP aging, profitability, cost drivers, custom), chart widgets, Report Viewer, period/compare, Export, "open in AI CFO".
- **Actions:** Open · Build custom · Set period/compare · Drill · Export · Share · Open in AI CFO.
- **Filters:** report type, period, dimension (customer/supplier/category), compare.
- **Tables:** aging buckets; profitability by dimension; cost breakdowns.
- **Widgets:** charts (bars/trends), KPI callouts, custom-report builder (drag dimensions/measures), AI CFO handoff.
- **Validation:** read-only; custom-report field consistency.
- **Empty:** "No management reports yet — try AR aging or build a custom report."
- **Loading:** chart/table skeletons.
- **Error:** generation failed; insufficient data for a chart.
- **Mobile:** simplified charts; list-first.
- **Navigation:** → AI CFO (SCR-AI-02) · Receivables/Payables · Banking.

```
 Reports ▸ Management
 ┌───────────┬───────────┬───────────┬────────────┐
 │ AR aging  │ AP aging  │Profitabil.│ + Custom    │
 └───────────┴───────────┴───────────┴────────────┘
 AR AGING                          [Open in AI CFO ▸]
  0–30: €3,200 · 31–60: €2,100 · 61–90: €1,800 · 90+: €1,020
  ▇▇▇▇ ▇▇▇ ▇▇ ▇   (bar chart)   [Export][Share]
```

---

# SETTINGS

Two-pane pattern: settings nav (left) + form/content (right), inline validation, save bar.

### SCR-SET-02 — User Management
- **Purpose:** invite/manage users and their per-company role assignments (firm-critical).
- **Role access:** Tenant Admin, Account Owner; firm principals.
- **Layout:** users table → user detail (per-company role matrix) → invite flow.
- **Components:** Table (users), invite modal, per-company role matrix (user × company × role), StatusChip (active/invited/disabled), search.
- **Actions:** Invite user · Edit roles · Assign companies · Disable/remove · Resend invite · Bulk assign.
- **Filters:** role, company, status (active/invited/disabled), search.
- **Tables:** users — `name · email · tenant role · #companies · status`; detail matrix — `company · role`.
- **Widgets:** role matrix; SoD policy indicator; invite status.
- **Validation:** unique email; at least one Owner/Admin; can't remove self if sole admin; invite delivery.
- **Empty:** "Invite your team."
- **Loading:** skeleton rows; invite spinner.
- **Error:** invite-failed inline; permission conflicts; last-admin protection.
- **Mobile:** list + detail in sheet; matrix simplified.
- **Navigation:** → Roles & Permissions (SCR-SET-03) · Team (firm) · individual user.

```
 Settings ▸ Users                                  [Invite]
 [Role ▾][Company ▾][Status ▾] 🔍
 ┌───────────┬────────────────┬───────────┬──────┬─────────┐
 │Name       │Email           │Tenant role│Comps │Status   │
 │M. Petrova │m.p@firm.bg     │Admin      │40    │Active   │
 │I. Ivanov  │i.i@firm.bg     │Member     │12    │Invited  │
 └───────────┴────────────────┴───────────┴──────┴─────────┘
 (detail) Company × Role matrix:  Acme [Senior ▾] · Beta [Acct ▾]
```

### SCR-SET-03 — Roles & Permissions
- **Purpose:** view/configure roles and the permission matrix; set firm policies (SoD).
- **Role access:** Tenant Admin, Account Owner.
- **Layout:** roles list (left) → permission matrix (right) + policy toggles.
- **Components:** roles list, permission matrix (action × role, view/create/edit/approve/sign/submit), policy toggles (preparer≠approver), guardrail notes.
- **Actions:** Select role · Toggle permissions (within guardrails) · Create custom role (if supported) · Set SoD policy · Save.
- **Filters:** module/action group, role.
- **Tables:** permission matrix — rows = actions, cols = roles, cells = allowed/scoped.
- **Widgets:** hard-guardrail badges (non-overridable: state submission needs approver+KEP; cross-tenant isolation); SoD toggle.
- **Validation:** cannot grant beyond plan/guardrails; non-overridable rules locked with explanation; at least one approver.
- **Empty:** n/a (defaults exist).
- **Loading:** matrix skeleton.
- **Error:** guardrail-violation explanation; save conflict.
- **Mobile:** read-first; editing → desktop.
- **Navigation:** → User Management · Security Settings · Audit (changes logged).

```
 Settings ▸ Roles & Permissions
 ┌───────────┬──────────────────────────────────────────────┐
 │ Roles     │ Action            │BK│Acct│Senior│Rev│Client │
 │ Bookkeeper│ Upload docs       │✔ │ ✔  │ ✔   │ – │ ✔     │
 │ Accountant│ Post entries      │● │ ✔  │ ✔   │ – │ –     │
 │ Senior ●  │ Approve postings  │– │ –  │ ✔   │ – │ –     │
 │ Reviewer  │ File/Sign (KEP)   │– │ –  │ ✔🔒 │ – │ –     │
 │ Client    │ …                 │  │    │     │   │       │
 └───────────┴──────────────────────────────────────────────┘
 Policy: ☑ Preparer ≠ Approver for state submissions   🔒 locked rules
```

### SCR-SET-05 — Localization
- **Purpose:** set language defaults, formats, and per-document language behavior.
- **Role access:** Tenant Admin, Account Owner; user-level language is per-user.
- **Layout:** form — default language, fallback, number/date/currency formats, document language, currency dual-display.
- **Components:** language default select (BG default), fallback display, format preview, document-language options, currency dual-display toggle (auto until 8 Aug 2026), save bar.
- **Actions:** Set default language · Set formats · Set document language · Toggle dual currency (where permitted) · Preview · Save.
- **Filters:** none.
- **Tables:** none.
- **Widgets:** live format preview (`1 234,56 €` vs `€1,234.56`; `02.06.2026` vs `2026-06-02`); fallback chain note; dual-currency window note.
- **Validation:** valid locale; document-language availability; dual-currency rule (legal window).
- **Empty:** n/a (defaults).
- **Loading:** save spinner.
- **Error:** save conflict; unsupported document language.
- **Mobile:** full-width form.
- **Navigation:** affects all screens; ← Settings.

```
 Settings ▸ Localization
 Default language    [ Български ▾ ]   Fallback: BG → EN
 Number format       1 234,56  (BG)        preview ✓
 Date format         02.06.2026 (dd.mm.yyyy)
 Currency            EUR  ·  ☑ Show BGN reference (until 8 Aug 2026)
 Document language   [ Match recipient ▾ ]
 [ Save ]
```

### SCR-SET-06 — Security Settings
- **Purpose:** manage account security — MFA, sessions, KEP auth, data residency, retention.
- **Role access:** Account Owner, Tenant Admin (some user-level).
- **Layout:** grouped settings cards — Authentication (MFA, KEP login), Sessions/devices, Data residency, Retention, Audit/export.
- **Components:** MFA management, session/device list (revoke), KEP-login toggle, data-residency selector, retention policy with legal note, export-audit action, status cards.
- **Actions:** Manage MFA · Revoke session/device · Enable KEP login · Set data residency · Set retention · Export audit · Configure backup/DR visibility.
- **Filters:** session status, device type.
- **Tables:** active sessions — `device · location · last active · [Revoke]`.
- **Widgets:** MFA status; device list; residency selector (EU); retention note (Bulgarian record-keeping); backup/DR status.
- **Validation:** can't disable MFA for required roles; residency/retention within legal bounds; revoke-self warning.
- **Empty:** n/a.
- **Loading:** spinners on actions.
- **Error:** action failures; policy-conflict explanations.
- **Mobile:** view + revoke sessions; complex config → desktop.
- **Navigation:** → KEP Certificate Management · Audit Trail · User Management.

```
 Settings ▸ Security
 AUTHENTICATION   MFA: Enabled ✓   KEP login: ☑
 SESSIONS & DEVICES
 ┌────────────────┬──────────────┬────────────┬─────────┐
 │Device          │Location      │Last active │         │
 │Chrome · Win    │Sofia, BG     │now         │[Revoke] │
 │iPhone app      │Sofia, BG     │2h ago      │[Revoke] │
 └────────────────┴──────────────┴────────────┴─────────┘
 DATA RESIDENCY [ EU ▾ ]   RETENTION [ 10 years ▾ ] (legal)
 [ Export audit log ]   Backups: EU-redundant ✓
```

---

## Closing — Figma handoff notes

- Build the **global shell once** (top bar, nav rail, AI launcher) as a template; every screen above inherits it (the wireframes show content area only, except dashboards/auth).
- Each data screen needs the **full state set** as Figma variants: default · loading (skeleton) · empty (first-use) · empty (filtered) · error · permission-denied (+ offline where capture/forms apply). This spec names the screen-specific copy for each.
- Reuse the **Design System components** (Section references throughout) — do not redraw buttons, fields, chips, tables, MoneyField, DualCurrencyAmount, ConfidenceBadge, SubmissionStepper, KepSignPanel, AiMessage, etc.
- Apply tokens, never raw values; verify every screen in **BG and EN** and in the **dual-currency mode**.
- Frame naming: `SCR-{AREA}-{NN} · {Screen} · {State}` (areas: AUTH, ONB, DSH, DOC, REV, SAL, INV, ACC, VAT, BNK, AI, NAP, KEP, RPT, SET, FRM, PRT).
- Wireframes here define **structure and hierarchy**, not pixels — compose with the design system for the finished frames.

*End of v1.0 screen specification & wireframe documentation. With the Master Architecture, UX Architecture, and Design System, this completes the design foundation: a Figma designer can build every screen directly from these four documents.*
