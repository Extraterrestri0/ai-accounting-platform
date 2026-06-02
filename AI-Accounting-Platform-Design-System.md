# AI Accounting Platform — Complete UI Design System

**Document type:** UI design system specification (design only — no code, React, or schema)
**Builds on:** *Master Architecture (v1.0)* and *Complete UX Architecture (v1.0)*
**Audience:** UI designers (Figma library build), brand, frontend handoff
**Goal:** detailed enough to build the full Figma design system — tokens, components, states, and structure
**Status:** v1.0 — design-system baseline

---

## How to read this document

- All values (hex, px, rem, weights) are **concrete and buildable** — use them as the literal token values in Figma.
- **Tokens use a two-tier model:** *primitive tokens* (raw values, e.g. `blue-500`) → *semantic tokens* (roles, e.g. `color.action.primary`). Components reference **semantic tokens only**, never raw values. This is what makes theming and white-label possible.
- The system is **light-mode first**; dark mode and per-firm white-label are defined as Figma *modes/variables* (Section 24) so they're config, not rework.
- **Currency rule across all components:** base = **EUR**; **BGN shown as a secondary reference until 8 Aug 2026** (fixed rate **1 EUR = 1.95583 BGN**), switchable off by a variable mode afterward.
- **Language:** Bulgarian is default; every text-bearing component is built Cyrillic-first.

---

## 1. Brand Direction

### 1.1 Brand essence
A modern, AI-powered accounting platform that makes Bulgarian small businesses and their accountants feel **calm, in control, and safe** with their money and their taxes. The brand sits at the intersection of **fintech trust** and **intelligent automation** — credible enough to handle the state, simple enough for someone who has never opened a ledger.

### 1.2 Brand attributes (and what they mean for the UI)

| Attribute | UI translation |
|-----------|----------------|
| **Trustworthy** | Banking-grade restraint; precise figures; nothing hidden; every number traceable |
| **Clear** | Plain language over jargon; generous whitespace; one primary action per view |
| **Intelligent** | AI is present but humble — it proposes, explains, and cites; never shouts |
| **Professional** | Clean, minimal, confident; no playful gimmicks around money or compliance |
| **Effortless** | Capture-first, review-don't-re-enter; the happy path is obvious |
| **Local + European** | Bulgarian-first language and letterforms; EUR-native; EU-credible |

### 1.3 Voice & tone
- **Default voice:** clear, warm, professional. Short sentences. Active voice. No accountancy jargon unless paired with a plain-language explanation.
- **Tone shifts by context:** encouraging in onboarding and empty states; neutral and precise in ledgers and reports; calm and explicit around compliance ("You are filing the May 2026 VAT return: €1,260 payable"); reassuring (never alarming) in errors.
- **AI tone:** helpful, transparent, never overconfident. Always frames output as guidance and points to sources. Never says "I filed it" — it cannot.

### 1.4 Logo & symbol guidance (conceptual, not a logo design)
- Wordmark in the primary typeface, Medium/Semibold weight, in `neutral-900` on light and `white` on the brand-blue.
- A simple, geometric mark that reads at 24px (favicon/app icon) and in monochrome. Avoid literal coins/calculators; lean abstract (e.g. a clean ascending/structured form suggesting order and growth).
- Clear space ≥ the mark's height; minimum sizes defined; never recolor outside the palette; never place on low-contrast backgrounds.
- App icon: brand-blue field, white mark.

### 1.5 Imagery & illustration
- Sparse, purposeful illustration — primarily in empty states and onboarding. Flat, two-to-three-color (blue/green/neutral), light, optimistic, **inclusive and locally relatable**, never clip-art.
- Minimal photography; if used, calm and professional. No stock "handshake/coins" clichés.
- Iconography: a single consistent line-icon set, 1.5–2px stroke, rounded joins, 24px base grid, two-tone allowed for emphasis. Status always pairs an icon with color + text (never color alone).

### 1.6 Brand do / don't
- **Do:** lean on white space, light-blue tints, and tabular figures; keep one clear action per screen; explain AI.
- **Don't:** use red/amber decoratively (reserved for risk/error/deadline); stack multiple competing CTAs; use gradients heavily; let the AI feel like a black box.

---

## 2. Color Palette

Colors are defined as **primitive ramps** (50–900) then mapped to **semantic roles**. Build the primitives as a Figma color variable collection; build semantics as aliases pointing at primitives, with modes for light/dark/white-label.

### 2.1 Primitive ramps

**Neutral / Gray** (text, surfaces, borders — the workhorse)

| Token | Hex | Typical use |
|-------|-----|-------------|
| `neutral-0` | `#FFFFFF` | Pure white surface / cards |
| `neutral-50` | `#F6F8FB` | App background |
| `neutral-100` | `#EDF1F6` | Subtle fills, table zebra, hover |
| `neutral-200` | `#DDE3EC` | Borders, dividers |
| `neutral-300` | `#C5CEDA` | Strong borders, disabled fill |
| `neutral-400` | `#9AA6B6` | Placeholder text, disabled text |
| `neutral-500` | `#6B7787` | Secondary / muted text |
| `neutral-600` | `#4B5563` | Body text (secondary emphasis) |
| `neutral-700` | `#353D49` | Headings (secondary) |
| `neutral-800` | `#232A33` | Strong text |
| `neutral-900` | `#12161C` | Primary text |

**Light Blue / Primary** (trust, primary actions, selection, links)

| Token | Hex | Typical use |
|-------|-----|-------------|
| `blue-50` | `#EEF5FE` | Lightest tint — info backgrounds, selected-row tint |
| `blue-100` | `#D6E8FC` | Brand tint, chips, AI panel background |
| `blue-200` | `#AFD0F8` | Light borders/accents on tint |
| `blue-300` | `#82B4F2` | Decorative accents, charts |
| `blue-400` | `#5495E9` | Hover on light, secondary accents |
| `blue-500` | `#2F7BE0` | **Primary action base** |
| `blue-600` | `#1F63C4` | Primary hover / link text on white (AA) |
| `blue-700` | `#184F9E` | Primary pressed / strong text |
| `blue-800` | `#143F7D` | Deep accents |
| `blue-900` | `#102F5C` | Darkest — headings on tint |

**Green / Success** (confirmed, posted, reconciled, paid, filed)

| Token | Hex | Typical use |
|-------|-----|-------------|
| `green-50` | `#ECFBF3` | Success background tint |
| `green-100` | `#D1F5E0` | Success chip fill |
| `green-200` | `#A6EAC4` | Borders on success tint |
| `green-300` | `#6FD9A0` | Accents / charts |
| `green-400` | `#38C07B` | Hover |
| `green-500` | `#16A463` | **Success base** (icons, high-confidence) |
| `green-600` | `#0E8650` | Success text on white (AA) / hover |
| `green-700` | `#0B6B41` | Pressed / strong success text |
| `green-800` | `#095334` | Deep |
| `green-900` | `#073D27` | Darkest |

**Amber / Warning** (needs attention, low–medium confidence, due soon)

| Token | Hex | Typical use |
|-------|-----|-------------|
| `amber-50` | `#FEF6E7` | Warning background tint |
| `amber-100` | `#FCE9C2` | Warning chip fill |
| `amber-200` | `#F8D386` | Borders on tint |
| `amber-300` | `#F2B947` | Icon/accent |
| `amber-400` | `#E39B12` | Warning base (icons) |
| `amber-500` | `#C07F08` | Strong amber (large text only) |
| `amber-600` | `#9A6406` | **Warning text on white (AA)** |
| `amber-700` | `#7A4F05` | Pressed |
| `amber-800` | `#5E3D04` | Deep |
| `amber-900` | `#422B03` | Darkest |

> Amber is the trickiest for contrast: use `amber-300/400` for icons and borders, fills from `amber-50/100`, and **`amber-600/700` for any text**. Never small amber text lighter than `amber-600`.

**Red / Error** (errors, overdue, rejected, validation failures)

| Token | Hex | Typical use |
|-------|-----|-------------|
| `red-50` | `#FDECEC` | Error background tint |
| `red-100` | `#FAD2D2` | Error chip fill |
| `red-200` | `#F3A8A8` | Borders on tint |
| `red-300` | `#E97777` | Accent |
| `red-400` | `#DD4B4B` | Hover |
| `red-500` | `#CB2A2A` | **Error / danger base** |
| `red-600` | `#A81F1F` | Danger hover / error text on white (AA) |
| `red-700` | `#861919` | Pressed |
| `red-800` | `#661414` | Deep |
| `red-900` | `#480E0E` | Darkest |

### 2.2 Semantic tokens (roles — components use these)

| Semantic token | → Primitive | Notes |
|----------------|-------------|-------|
| `color.bg.app` | `neutral-50` | Page background |
| `color.bg.surface` | `neutral-0` | Cards, panels, tables |
| `color.bg.surface.raised` | `neutral-0` + shadow | Overlays/menus |
| `color.bg.subtle` | `neutral-100` | Hover rows, subtle fills |
| `color.bg.selected` | `blue-50` | Selected row/item tint |
| `color.bg.ai` | `blue-100` | AI message/panel background |
| `color.border.default` | `neutral-200` | Dividers, input borders |
| `color.border.strong` | `neutral-300` | Emphasis borders |
| `color.border.focus` | `blue-500` | Focus ring (2px + 2px offset) |
| `color.text.primary` | `neutral-900` | Default text |
| `color.text.secondary` | `neutral-600` | Supporting text |
| `color.text.muted` | `neutral-500` | Captions, placeholders |
| `color.text.on-primary` | `neutral-0` | Text on blue/green/red fills |
| `color.text.link` | `blue-600` | Links |
| `color.action.primary` | `blue-500` | Primary buttons |
| `color.action.primary.hover` | `blue-600` | |
| `color.action.primary.active` | `blue-700` | |
| `color.action.commit` | `green-600` | NAP/KEP commit (see §6.5) |
| `color.action.danger` | `red-500` | Destructive |
| `color.status.success` | `green-500` | |
| `color.status.warning` | `amber-400` | (text → `amber-600`) |
| `color.status.error` | `red-500` | |
| `color.status.info` | `blue-500` | |
| `color.status.neutral` | `neutral-400` | Draft/inactive |
| `color.confidence.high` | `green-500` | ≥90% |
| `color.confidence.medium` | `amber-400` | 70–89% |
| `color.confidence.low` | `red-500` | <70% |

### 2.3 Status → color mapping (used by badges, §10)

| Status | Color role | Visual |
|--------|-----------|--------|
| Draft / Inactive | neutral | gray dot + label |
| Info / Proforma | info (blue) | blue tint chip |
| Processing / Pending | info (blue) | blue chip + subtle motion |
| Needs attention / Due soon / Low-med confidence | warning (amber) | amber chip + ⚠ icon |
| Success / Posted / Reconciled / Paid / Filed | success (green) | green chip + ✓ icon |
| Error / Overdue / Rejected / Failed | error (red) | red chip + ✕/! icon |

### 2.4 Color usage rules
- **60-30-10:** ~60% neutral/white surfaces, ~30% light-blue tints & structure, ~10% saturated action/status color.
- **Reserve red & amber strictly** for risk, errors, deadlines, and confidence — never decoration.
- **Color is never the only signal:** pair with icon + text (accessibility).
- **Financial polarity:** negative/payable amounts may use `red-600` text, positive/receivable `green-600` — but always with sign/label, never color alone.
- Charts use blue/green/neutral primaries with the ramp's 300–500 steps; add categorical hues only if needed and only from tints, keeping red/amber meaningful.

---

## 3. Typography

### 3.1 Typeface selection (Bulgarian-first, Cyrillic + Latin)

Bulgarian Cyrillic has **distinct localized letterforms** (е.g. в, г, д, ж, з, и, й, к, л, п, т, ц, ш differ from Russian Cyrillic). The chosen typeface **must support Bulgarian localized forms via the OpenType `locl` feature**, and `locl` must be enabled with language set to Bulgarian.

- **Primary UI typeface (recommended):** **Inter** — open-source, excellent screen legibility, broad Cyrillic coverage, supports `locl` (verify Bulgarian forms in build), and `tnum` tabular figures. Strong default.
- **Alternative:** **IBM Plex Sans** (open, Cyrillic, tnum) for a slightly warmer, more distinctive voice.
- **Premium/local option:** a Bulgarian foundry family (e.g. Fontfabric) for a more locally-authentic feel, if licensing budget allows — chosen specifically for verified Bulgarian Cyrillic letterforms.
- **Numeric/tabular:** the same family with **`tnum` (tabular figures) enabled on every financial number** so digits align in columns. No separate mono font required; a monospace (e.g. IBM Plex Mono) is optional for document hashes/IDs only.

**Hard requirements regardless of family:** full Latin + Cyrillic, Bulgarian `locl`, four weights, real tabular figures, and a license covering web + app.

### 3.2 Type scale

Base size 16px (1rem). UI data-dense default body is 14px. Line-heights tuned for Cyrillic ascenders/descenders.

| Token | Size px / rem | Line-height | Weight | Letter-spacing | Use |
|-------|---------------|-------------|--------|----------------|-----|
| `type.display` | 36 / 2.25 | 44 | 600 | -0.5px | Marketing/hero, big KPI numbers |
| `type.h1` | 28 / 1.75 | 36 | 600 | -0.25px | Page titles |
| `type.h2` | 22 / 1.375 | 30 | 600 | 0 | Section headers |
| `type.h3` | 18 / 1.125 | 26 | 600 | 0 | Card titles, subsections |
| `type.body-lg` | 16 / 1.0 | 24 | 400 | 0 | Comfortable reading, dialogs |
| `type.body` | 14 / 0.875 | 22 | 400 | 0 | **Default UI text, tables** |
| `type.body-strong` | 14 / 0.875 | 22 | 600 | 0 | Emphasis in body |
| `type.body-sm` | 13 / 0.8125 | 20 | 400 | 0 | Dense tables, secondary |
| `type.caption` | 12 / 0.75 | 16 | 500 | 0.2px | Labels, badges, metadata |
| `type.overline` | 11 / 0.6875 | 14 | 600 | 0.6px (uppercase) | Group headers, eyebrow |

**Numeric styles** (apply `tnum`; right-align in tables):

| Token | Size | Use |
|-------|------|-----|
| `type.num.kpi` | 28–32, 600 | Dashboard KPI figures |
| `type.num.body` | 14, 400/600 | Amounts in tables/forms |
| `type.num.sm` | 13, 400 | Secondary BGN reference |

### 3.3 Typographic rules
- **Weights:** 400 Regular, 500 Medium, 600 Semibold, 700 Bold (sparingly). Avoid Light weights (poor Cyrillic legibility at UI sizes).
- **Tabular figures everywhere money appears** — totals, ledgers, KPIs, the dual-currency reference.
- **Bulgarian text runs longer than English** in places and shorter in others; never lock heights to a single language. Allow ~+30% width tolerance and wrapping.
- **Case:** sentence case for almost everything (labels, buttons, headers). Reserve UPPERCASE for `overline` only; uppercase reduces Cyrillic legibility.
- **Alignment:** text left-aligned (LTR); numbers right-aligned. No justified text.
- **Line length:** 60–80 characters max for reading content (reports, help).
- **Minimum text size 12px**; never below for body. Captions on dense screens 12–13px.

---

## 4. Spacing System

A **4px base grid**. All padding, margins, and gaps reference these tokens.

| Token | px | Use |
|-------|----|----|
| `space-0` | 0 | Reset |
| `space-1` | 4 | Icon-to-text, tight chips |
| `space-2` | 8 | Compact gaps, badge padding |
| `space-3` | 12 | Input padding, small card gaps |
| `space-4` | 16 | **Default gap / card padding** |
| `space-5` | 20 | Comfortable gap |
| `space-6` | 24 | Section gap, card padding (roomy) |
| `space-8` | 32 | Block separation |
| `space-10` | 40 | Major section spacing |
| `space-12` | 48 | Page section spacing |
| `space-16` | 64 | Hero / large empty states |

### 4.1 Application guidance
- **Inside controls:** buttons/inputs vertical padding from height tokens (§6/§7); horizontal `space-3`–`space-4`.
- **Cards:** `space-4` (compact) to `space-6` (default) padding; `space-4` gap between cards.
- **Forms:** `space-4` between fields, `space-2` between label and control, `space-6` between field groups.
- **Tables:** cell padding `space-3` vertical (comfortable) or `space-2` (compact), `space-4` horizontal.
- **Page:** content padding `space-6` desktop, `space-4` mobile; section spacing `space-8`–`space-12`.
- **Touch targets:** minimum 44×44px hit area regardless of visual size.

---

## 5. Layout Grid

### 5.1 Breakpoints

| Name | Range | Columns | Margin | Gutter |
|------|-------|---------|--------|--------|
| Mobile | < 640 | 4 | 16 | 16 |
| Tablet | 640–1023 | 8 | 24 | 24 |
| Desktop | 1024–1439 | 12 | 32 | 24 |
| Wide | ≥ 1440 | 12 | auto (centered) | 24 |

### 5.2 App frame dimensions
- **Top bar height:** 56px (desktop), 56px sticky.
- **Left nav rail:** 240px expanded / 64px collapsed (icon-only). Sticky.
- **Content area:** fills remaining width; **max readable content width 1200px** for forms/reports (tables may go full width); centered beyond `wide`.
- **Right slide-over panel:** 400px (detail), 360px (AI panel); pushes or overlays content per screen.
- **Mobile:** no rail; bottom tab bar 56px + safe-area inset; single-column content.

### 5.3 Layout patterns (from the UX doc)
- **List page:** filter bar (sticky) + full-width table + bulk action bar (sticky bottom when selecting).
- **Detail split:** left viewer / right data (≥1024px); stacks vertically below.
- **Dashboard grid:** 12-col; KPI tiles span 3 cols each (4 across), content cards span 6–12.
- **Workflow:** centered max-width column + horizontal stepper + sticky commit bar.
- **Forms:** single column, max 720px width, grouped with section headers.

### 5.4 Elevation / shadow tokens

| Token | Use | Spec (indicative) |
|-------|-----|-------------------|
| `elevation-0` | Tables, inputs | none; 1px border |
| `elevation-1` | Cards | soft, y2 blur8, ~8% neutral-900 |
| `elevation-2` | Dropdowns, popovers | y4 blur16, ~12% |
| `elevation-3` | Modals, slide-overs | y8 blur32, ~16% + scrim |

Scrim for modals: `neutral-900` at 40–50% opacity.

---

## 6. Buttons

### 6.1 Anatomy & sizes
Anatomy: `[ optional leading icon ][ label ][ optional trailing icon/caret ]`, centered, with optional loading spinner replacing the leading icon.

| Size | Height | Padding-x | Text | Icon | Use |
|------|--------|-----------|------|------|-----|
| `sm` | 32 | 12 | body-sm 13/600 | 16 | Inline, table row actions, filters |
| `md` | 40 | 16 | body 14/600 | 18 | **Default** |
| `lg` | 48 | 20 | body-lg 16/600 | 20 | Primary page actions, mobile, commit |

Radius: `radius-sm` (6px). Full-width variant for mobile and dialogs. Icon-only button = square at the same height; always has an aria-label/tooltip.

### 6.2 Variants & token mapping

| Variant | Fill | Text | Border | Hover | Active | Use |
|---------|------|------|--------|-------|--------|-----|
| **Primary** | `blue-500` | `white` | none | `blue-600` | `blue-700` | The one main action per view |
| **Secondary** | `white` | `blue-600` | 1px `blue-200` | `blue-50` fill | `blue-100` fill | Alternative actions |
| **Ghost** | transparent | `neutral-700` | none | `neutral-100` fill | `neutral-200` fill | Tertiary, toolbars, low-emphasis |
| **Danger** | `red-500` | `white` | none | `red-600` | `red-700` | Destructive (delete, reject) |
| **Danger-ghost** | transparent | `red-600` | none | `red-50` fill | `red-100` | Low-emphasis destructive |
| **Commit (NAP/KEP)** | `green-600` | `white` | none | `green-700` | `green-800` | Sign / File / Submit (§6.5) |
| **Link** | none | `blue-600` underline-on-hover | none | — | — | Inline navigation |

### 6.3 States (all variants)
- **Default / Hover / Active** as above.
- **Focus:** 2px `blue-500` focus ring, 2px offset (visible on keyboard focus).
- **Disabled:** `neutral-100` fill / `neutral-400` text (or 40% opacity for filled), no shadow, `not-allowed` cursor.
- **Loading:** spinner replaces leading icon, label stays, button disabled; for commit actions show progress text ("Signing…").

### 6.4 Button rules
- **One primary per view.** Everything else is secondary/ghost.
- Buttons are **verbs**: "Issue invoice," "Approve & post," "Sign with KEP." Never "OK/Submit" alone.
- Destructive actions use Danger + a confirmation; never auto-destroy.
- Don't place primary and danger adjacent without separation.
- Sticky action bars: primary right-most; cancel/back left or ghost.

### 6.5 Commit / action buttons for NAP & KEP (special class)
High-stakes, irreversible-feeling actions (file to NAP, sign with KEP, lock period). They get a distinct treatment to signal gravity:

- **Visual:** Commit variant (`green-600` filled, `lg` size) with a relevant icon (shield/signature/paper-plane). Visually weightier than ordinary primaries.
- **Always preceded by a confirmation summary** stating exactly what will happen and the amount/period: *"You are filing the VAT return for May 2026 — €1,260 payable. This locks the period."* with `[Cancel]` and `[Confirm & file]`.
- **Shows what is being committed** (e.g. the document/hash for KEP) — never blind.
- **Progress + result:** explicit step feedback ("Signing… Signed ✓ by M. Petrova, 14:22") and a clear success or failure end-state written to the audit trail.
- **Guarded by permission + condition** (ABAC): disabled with explanation if the user lacks the Approver role, KEP isn't configured, or validation has blocking errors.

---

## 7. Form Fields

### 7.1 Anatomy
`Label (required *) → Control → Helper text → Error text`. Optional leading/trailing icon, prefix/suffix, character count, inline action.

### 7.2 Sizes & base style
- Height: `sm` 32 / `md` 40 (default) / `lg` 48.
- Padding-x `space-3`; radius `radius-sm`; 1px `neutral-200` border on `white`.
- Label: `caption` 12/500 `neutral-600`, `space-2` above control. Required marker `red-500` asterisk.
- Helper: `caption` `neutral-500`. Error: `caption` `red-600` + 16px error icon.

### 7.3 States

| State | Border | Fill | Text | Notes |
|-------|--------|------|------|-------|
| Default | `neutral-200` | white | `neutral-900` | |
| Hover | `neutral-300` | white | | |
| Focus | `blue-500` (+focus ring) | white | | 2px ring |
| Filled | `neutral-200` | white | | |
| Disabled | `neutral-200` | `neutral-100` | `neutral-400` | no-cursor |
| Read-only | none | `neutral-50` | `neutral-700` | for posted/locked data |
| Error | `red-500` | white | | error text + icon below |
| Warning | `amber-400` | white | | non-blocking caution |
| Success | `green-500` | white | | e.g. VIES-validated ✓ |

### 7.4 Field types (controls)
- **Text / Textarea** (textarea: resizable vertical, char count optional).
- **Number** (right-aligned, step controls optional).
- **MoneyField** — see §12.1.
- **Select** (single) — caret, menu uses `elevation-2`; selected = `blue-50` row.
- **Combobox / Autocomplete** — type-ahead, async results, empty "no matches," used for customers, accounts, catalogue.
- **MultiSelect** — chips inside the field; overflow "+N."
- **Checkbox / Radio** — 18px, `blue-500` when selected; indeterminate state for tables.
- **Toggle** — 36×20, `green-500` on / `neutral-300` off; for settings only (not for committing data).
- **DatePicker** — calendar popover; BG/EN locale-aware format (§23).
- **PeriodPicker** — month/quarter/year selector tuned to VAT periods; "current period" shortcut.
- **File input** — see Upload (UX doc) / Dropzone primitive.

### 7.5 Validation patterns
- **Inline, on blur** for format checks (EIK checksum, IBAN, VAT pattern); **on submit** for completeness.
- Error text says **what + how to fix**; never just "invalid."
- **Async validation** (VIES, EIK lookup) shows a spinner in the trailing slot → success ✓ or warning with allow-override + reason.
- **Never clear user input** on error.
- Group-level error summary at the top of long forms, linking to the first invalid field.

---

## 8. Tables

The backbone of an accounting product. Two densities: **comfortable** (default) and **compact** (data-heavy ledgers/queues).

### 8.1 Anatomy
- **Header row:** `caption`/`body-sm` 600, `neutral-600`, `neutral-50` background, sticky on scroll, sort affordance on sortable columns.
- **Body rows:** `body`/`body-sm`, `neutral-900`; row height 48 (comfortable) / 40 (compact).
- **Dividers:** 1px `neutral-200` between rows (preferred over heavy zebra; optional `neutral-50` zebra for very wide tables).
- **Hover:** row `neutral-100`. **Selected:** row `blue-50` + left 2px `blue-500` marker.
- **Cell alignment:** text left, **numbers right with tabular figures**, status centered or left with chip.

### 8.2 Features
- **Sort** (single/multi), **column resize/reorder** (optional), **sticky first column** (e.g. account/date) and sticky header.
- **Row selection** (checkbox col) → sticky **bulk action bar** appears at bottom with count + actions.
- **Row actions:** trailing `⋯` menu or inline ghost buttons on hover.
- **Drill-down:** any figure/row → detail (slide-over) or source document; cursor + subtle affordance.
- **Pagination** or virtualized infinite scroll for large ledgers; page-size control.
- **Inline editing** only where appropriate (e.g. invoice lines); otherwise open detail.
- **Expandable rows** for grouped data (e.g. ledger account → entries).
- **Totals/footer row** pinned, bold, with balanced indicator for trial balance.

### 8.3 Table states
- **Loading:** 5–8 skeleton rows (shimmer), header visible.
- **Empty (first-use):** in-table empty state with action ("No invoices yet — Create one").
- **Empty (filtered):** "No results match these filters — Clear filters."
- **Error:** in-table banner + retry; partial-row error chips if some rows failed to load.
- **Validation rows:** flagged rows get a left `amber/red` marker + a flag chip linking to the fix.

### 8.4 Financial table specifics
- Currency columns: EUR primary value; optional muted BGN reference on a second line or adjacent muted column (until Aug 2026).
- Negative amounts: `red-600` with minus sign (and parentheses optional per report convention).
- Running balance column right-aligned, bold at totals.
- Date format per locale; sortable; default newest-first or chronological per context.

---

## 9. Cards

### 9.1 Base card
`white` surface, `radius-md` (8px), `elevation-1`, padding `space-4`–`space-6`. Optional header (title + action), body, footer.

### 9.2 Card variants

| Variant | Contents | Notes |
|---------|----------|-------|
| **KPI tile** | overline label, big number (`type.num.kpi`), trend ▲▼ + delta, sublabel, tap target | Dashboard; whole card is a link |
| **Content card** | title + body (chart/list/text) + optional footer action | General container |
| **Status card** | icon, status, primary figure, action (e.g. "VAT — Ready to file") | Compliance dashboard |
| **List card** | header + rows of `ListRow` | Attention list, activity, risk feed |
| **Action card** | illustration/icon + headline + button | Empty states, prompts |
| **Selectable card** | radio/checkbox affordance + content | Onboarding choices, KEP method |

### 9.3 Card rules
- Each card answers one question and offers one obvious next step.
- Card titles `h3`; never more than one primary action per card.
- KPI tiles maintain equal height in a row; numbers tabular and prominent; trend color = green up / red down only where "up = good" (invert sensibly for payables/expenses, and always pair with sign).

---

## 10. Badges & Status Indicators

### 10.1 Status chip (pill)
`caption` 12/500, height 22, radius-full (pill), `space-1` icon + label, tinted background + matching text per §2.3. Always **icon + text + color** (never color alone).

Examples (label · fill · text · icon):
- Draft · `neutral-100` · `neutral-700` · ○
- Proforma/Info · `blue-50` · `blue-700` · ⓘ
- Processing · `blue-50` · `blue-700` · ◔ (subtle motion)
- Due soon / Needs review · `amber-50` · `amber-700` · ⚠
- Posted/Paid/Reconciled/Filed · `green-50` · `green-700` · ✓
- Overdue/Error/Rejected · `red-50` · `red-700` · !

### 10.2 Dot indicator
6–8px filled dot in status color, for compact contexts (table cells, nav). Paired with text label or accessible label.

### 10.3 Count badge
Small filled circle/pill on nav items and tabs; amber for "attention," red for "overdue/error," neutral/blue for informational counts; max display "99+".

### 10.4 Tag
Neutral, removable chips for categories/labels (e.g. document tags); `neutral-100` fill, optional ✕.

### 10.5 Validation badge
For deterministic checks (EIK ✓, VIES ✓, IBAN ✓, "Net+VAT=Total ✓"): small green ✓ chip with the check name; failed = red with the issue.

---

## 11. Confidence Indicators (AI)

Distinct from generic status — they communicate **how sure the AI is**, at field and document level.

### 11.1 Tiers & thresholds

| Tier | Range | Color | Icon | Meaning |
|------|-------|-------|------|---------|
| **High** | ≥ 90% | `green-500` | 🟢 / ✓ | Safe to fast-track / bulk-approve |
| **Medium** | 70–89% | `amber-400` | 🟠 / ~ | Review recommended |
| **Low** | < 70% | `red-500` | 🔴 / ! | Must review |
| **Validated** | n/a | `green-600` | ✓ | Deterministically verified (not a guess) |

### 11.2 Forms
- **Confidence badge (pill):** colored dot + percentage, e.g. `🟢 96%`. Used per field and as a document-level summary.
- **Confidence meter (bar):** thin 4px bar filled to % in tier color; for detail views.
- **Field-level treatment:** low/medium fields get an amber/red left border or highlight + the badge, drawing the eye to what needs checking.
- **Why affordance:** every confidence badge sits next to a `why? ⓘ` that reveals reasoning + learned history.

### 11.3 Rules
- Confidence is **advisory, not decorative** — it drives sort order, bulk-approve eligibility, and visual emphasis in the Review Queue.
- Distinguish **"validated ✓"** (deterministic: checksum/arithmetic/VIES) from **"high confidence"** (AI estimate). The former is fact; the latter is a strong guess. Never show a percentage on a deterministic check.
- Confidence never appears on figures that came from the ledger (those are facts, not predictions).

---

## 12. Financial Components

### 12.1 MoneyField (input)
- Right-aligned, **tabular figures**, currency indicator (prefix `€` or suffix per locale, §23), thousands/decimal per locale.
- Handles paste/format normalization; 2 decimals default; no currency conversion typing (display-only conversion lives in DualCurrencyAmount).
- States inherit form-field states; error for non-numeric / out-of-range.
- Optional inline "= BGN X" helper while dual display is active.

### 12.2 DualCurrencyAmount (display)
- **EUR primary**, prominent, tabular; **BGN secondary** muted (`type.num.sm`, `neutral-500`) directly below or after, prefixed "≈" or "BGN".
- Driven by a **variable mode `currency.dual = on|off`**: on until 8 Aug 2026, then BGN hidden by config (no redesign).
- Fixed rate **1 EUR = 1.95583 BGN** noted on hover/tooltip; rounding per legal convention.
- Layout variants: stacked (cards/KPIs), inline (tables), single (post-Aug-2026).

```
Stacked:        Inline (table cell):     Single (post Aug 2026):
€ 600.00        € 600.00  ≈ BGN 1,173.50  € 600.00
≈ BGN 1,173.50
```

### 12.3 VAT Selector
- A specialized Select showing Bulgarian VAT treatments with code + label + tag:
  - `20%` Standard · `9%` Reduced · `0%` Zero-rated · `Exempt` · `RC` Reverse charge · `Intra-EU`.
- Each option a colored tag for quick scanning; reverse-charge/intra-EU show an info note ("VAT self-charged / not charged").
- Auto-suggested from counterparty VAT status with a visible "auto" marker; user can override.
- Disabled/locked appearance when period is filed.

### 12.4 Account Picker
- Combobox over the **Bulgarian national chart of accounts (classes 1–7)**: shows `code — name` (e.g. `601 — Materials`), grouped by class, searchable by code or name (BG/EN).
- Recent/frequent accounts surfaced first; tree-expand to browse.
- Inline create (if permitted); shows account type/normal balance hint.
- Used in journal editor, expense categorization, mapping screens.

### 12.5 Other financial primitives
- **TotalsPanel:** net / VAT (per rate) / total, dual-currency, right-aligned, total emphasized.
- **BalanceIndicator:** green ✓ "Balanced" / red ✗ "Out by € X" for journal & trial balance.
- **AmountDelta:** signed value with ▲▼ and color (good/bad aware).
- **VAT rate tag:** small colored tag (20/9/0/RC/Exempt) reused in tables.

---

## 13. Document Review Components

The components that make the AI Review Queue and Document Detail work (UX doc §8).

- **DocumentViewer** — zoom/pan, page navigation (multi-page PDF/TIFF), fit-to-width, rotate; supports **field-highlight overlays** that link to the extracted field list (hover a field → its location highlights, and vice versa). Loading skeleton; error "couldn't render — download original."
- **ExtractionFieldRow** — `label · value · ConfidenceBadge · ValidationBadge`. Editable on click; low/medium confidence visually flagged; deterministic checks show ✓ not %. Used for the full field set (supplier, VAT no., EIK, invoice no., date, net, VAT, total, currency, IBAN, description).
- **AISuggestionBlock** — shows the proposed **journal entry** (Dr/Cr lines via AccountPicker), the **VAT treatment** (VAT Selector), confidence, and a **`why?`** expander revealing reasoning + learned history ("Matches how you coded Supplier X 7×"). Editable; edits feed the learning loop with a subtle "the AI will remember this" confirmation.
- **DuplicateWarning** — inline `amber` banner with a **`Compare`** action opening **DuplicateCompare** (side-by-side of the two documents/postings) → resolve as duplicate / confirm distinct.
- **ReviewActionBar (sticky)** — `[Reject] [Edit fields] [Approve & post ✔]`; keyboard shortcuts (A/E/R/→); approve disabled while blocking validation exists, with reason.
- **ReviewQueueRow** — compact table row: type · counterparty · amount · ConfidenceBadge · flags · action; bulk-select; high-confidence + flag-free eligible for bulk approve.

---

## 14. Invoice Components

For invoice / credit note / debit note / proforma (UX doc §9). Shared builder, type-specific behavior.

- **DocumentTypeHeader** — title + numbering series + number; type badge (Invoice / Credit / Debit / **Proforma "not a tax document"**); language selector; currency indicator.
- **CustomerSelect** — Combobox with **VIES/EIK validation badge** inline (✓ validated / ⚠ unverified-with-override); shows EIK + VAT no. once selected.
- **InvoiceLineTable** — editable rows: item (catalogue Combobox) · qty · unit price (MoneyField) · VAT Selector · net · line total; add/remove/reorder lines; per-line VAT auto-calc.
- **TotalsPanel** — net, VAT by rate, total, **DualCurrencyAmount**; emphasized total.
- **ReferenceSelector** (credit/debit notes) — required link to original invoice; shows original amounts; reason field required.
- **InvoicePreview** — live rendered preview in selected language with dual currency; print/PDF styling reference.
- **InvoiceActionBar (sticky)** — `[Save draft] [Preview] [Issue] [Issue & email]`; proforma shows `[Convert to invoice]`.
- **InvoiceStatusChip** — draft / issued / sent / paid / overdue / credited.
- Validation surfaces: mandatory-field gate before issue, numbering-gap warning, VIES-invalid override-with-reason, email-send-failure retry.

---

## 15. Dashboard Components

For all four dashboards (UX doc §6).

- **KPITile** — overline label, KPI number (`type.num.kpi`, dual currency where monetary), trend ▲▼ + delta, sublabel, whole-card link; semantic color for trend (good/bad aware).
- **DeadlineStrip** — sticky top banner near due dates: icon + "VAT return due in 3 days" + count + action; amber as it nears, red when overdue.
- **DeadlineCard / DeadlineCalendar** — date, type (VAT 14th / SAF-T / annual), company (firm), owner, action; week/month/list views.
- **AttentionList** — list of "needs your attention" items, each with count + deep-link action.
- **RiskFeedItem** — ⚠ icon + plain-language risk + `why?` + fix action (e.g. "Unusual amount on Supplier X — Open").
- **ClientHealthRow** (firm) — client · health indicator (🟢🟠🔴) · next deadline · assignee; sortable by health.
- **TeamWorkloadBar** (firm) — name + capacity bar (% load), overload flag.
- **ActivityItem** — ✓ icon + action + timestamp + actor (incl. AI), link to audit.
- **SetupChecklist** — first-use dashboard replacement: steps with completion state + CTA each.

---

## 16. AI Accountant Components

For the assistant (UX doc §11). Distinct, calm "AI" styling within the blue family — never mistaken for a destructive or commit action.

- **AiLauncher (FAB)** — persistent bottom-right floating button, blue, with an AI glyph; badge if proactive insight available; opens AiPanel.
- **AiPanel** — right slide-over (360px) with a **context header** ("Context: VAT return · May 2026"), message thread, and composer; full-page variant for focused use.
- **AiMessage** — user (right, neutral) vs assistant (left, `blue-100` background bubble/card). Assistant message composes:
  - **MessageBody** (markdown-light: text, lists, inline figures with tabular numbers),
  - **SourceCitation** chips — `• Sales ledger (May) [open]`, `• ZDDS art. … [view]` — linking to the company's own data and/or tax rules,
  - **SuggestedActionChips** — deep-link chips ("Open VAT return," "Explain the calculation," "Show overdue invoices"),
  - **GuidanceNote** — persistent subtle disclaimer ("Guidance — you decide & approve before filing").
- **AiQuickPrompts** — chips above the composer tailored to the current screen ("VAT? · Deadlines? · P&L?").
- **AiComposer** — text input + send; streaming/thinking indicator (dots) while responding.
- **States:** empty (greeting + examples), streaming, low-confidence ("I'm not certain — verify with your accountant"), error ("Couldn't reach the assistant — your data is unaffected," retry; app keeps working).
- **Rule:** the AI surface never contains a Commit button; it can *link to* a workflow, but signing/filing always happens in the deliberate NAP/KEP flow.

---

## 17. NAP & KEP Components

For compliance workflows (UX doc §12). These carry the most gravity in the system.

- **SubmissionStepper** — horizontal gated stepper: `①Prepare ②Validate ③Approve ④Sign ⑤Submit ⑥Done`; current step emphasized, completed steps ✓, future steps muted; cannot advance past blocking errors.
- **ValidationPanel** — summary "✓ 0 errors · ⚠ 2 warnings"; expandable list of issues, each with a deep-link `[Fix]`; errors block, warnings require acknowledgment.
- **AISummaryCard** — plain-language read of the result ("Net VAT payable €1,260; two reverse-charge items verified") with sources; advisory only.
- **CommitConfirmation** — modal summarizing exactly what's being committed (period, amount, "this locks the period") with `[Cancel]` / `[Confirm & file]` (Commit button, §6.5).
- **KepSignPanel** — what's being signed (name + hash), **method selector** (Cloud QES / Card-Token / Mobile), **provider selector** (B-Trust / Evrotrust / StampIT …), and a phase stepper (Prepare → Authenticate → Apply → Verify). Never blind signing; never stores keys. Success shows signer + certificate + timestamp.
- **SubmissionHistoryRow** — period · type (VAT return / VIES / SAF-T) · status chip · signed-by · confirmation `[View] [Download]`.
- **ComplianceStatusCard** — per-area status (VAT / Next deadline / SAF-T "not in scope*" / KEP configured ✓) with action; SAF-T informational note about phased scope.
- **Status semantics:** Draft → Ready → Approved → Signed → Filed ✓ / Rejected / Error; "not filed" must never look like "filed."
- **Error components:** certificate expired/revoked, middleware missing (install guide), submission failure (keeps signed file, retry), each with a clear recovery path.

---

## 18. Mobile Components

Capture-, approve-, glance-first (UX doc §13). Larger targets, simpler surfaces.

- **BottomTabBar** — 5 slots: Home · Documents · **CaptureButton (center, raised)** · Review · AI; 56px + safe-area; active tab in `blue-600`.
- **CaptureButton** — prominent central circular FAB opening camera-first capture (auto-crop/de-skew, multi-shot batch).
- **MobileReviewCard** — stacked review surface: document thumbnail/viewer on top, key fields + AISuggestion below; **swipe-to-approve** (right) / reject (left) for high-confidence; tap to open full review.
- **MobileDashboard** — single-column reflow of KPI tiles + deadline strip pinned.
- **MobileSheet** — bottom sheet for actions/filters/pickers (replaces desktop popovers); drag handle; large rows.
- **QuickInvoice** — minimal flow: recent customer → one line → issue/share.
- **ProcessingChip / SyncStatus** — capture queue + offline "will send when online" indicator.
- **BiometricUnlock** — Face/Touch unlock entry pattern.
- **Mobile rules:** targets ≥44px; thumb-reachable primary actions; forgiving errors (re-shoot, retry); no manual journal editing / complex reconciliation / submission signing on mobile (point to desktop; can *initiate*).

---

## 19. Empty States

### 19.1 Anatomy
`Illustration/icon → Headline (h3) → Supporting line (body, neutral-500) → Primary action (button) → optional secondary link`. Centered in the container; calm, encouraging.

### 19.2 Variants
- **First-use (no data yet):** explain the value + the single best action. *"No documents yet — upload or forward a bill to start. [Upload] · How capture works"*
- **Filtered (no results):** *"No results match these filters. [Clear filters]"* — no illustration, lighter weight.
- **All-clear (positive):** *"All caught up 🎉 — nothing to review."* — green accent, reassuring.
- **Not-in-scope (informational):** e.g. SAF-T — *"SAF-T isn't required for this company yet. [Learn more]"*
- **Portal (client):** warm, jargon-free — *"Nothing to do right now — we'll let you know if we need anything."*

### 19.3 Rules
One action max (the best next step). Tone matches context (encouraging vs neutral vs celebratory). Never a dead end. Reuse a small consistent illustration set.

---

## 20. Error States

### 20.1 Levels

| Level | Component | When |
|-------|-----------|------|
| **Field** | inline error text + red border + icon | Validation on a single input |
| **Form** | error summary card at top, links to fields | Multiple/blocking validation on submit |
| **Inline/section** | banner inside a card/table | A section failed to load/act |
| **Page** | page-level banner (dismissible where safe) | Non-fatal page issue, with retry |
| **Full-page** | centered error state + retry/home | Fatal load failure |
| **Toast** | transient bottom toast | Async result (success/failure of background action) |

### 20.2 Specialized errors
- **Network/offline:** "You're offline — changes are saved and will sync." (queue chip)
- **Permission-denied:** "You don't have access to this — ask your firm admin." (who to contact)
- **Compliance/submission failure:** never silent; keeps signed artifacts; explicit "Not filed — retry."
- **AI unavailable:** "Couldn't reach the assistant — your data is unaffected." (core app unaffected)
- **Upload errors:** unsupported type / too large / corrupt / password-protected / virus-detected / blurry — each with the fix.

### 20.3 Rules
- Say **what happened + how to fix it**; avoid codes/jargon (offer a detail link for support).
- **Never lose user input.** Preserve form state through errors.
- Errors are calm, not alarming; red used precisely. Distinguish *blocking* (red) from *caution* (amber).

---

## 21. Loading States

- **Skeletons over spinners** for page/section/table/card loads (shimmer animation); preserve layout to avoid shift.
- **Progressive rendering:** show data as it arrives (dashboards, search) rather than blocking the whole view.
- **Inline button loading:** spinner replaces leading icon; label persists; commit actions show progress text.
- **Document processing chips:** `Queued → Scanning → Reading → Extracting → Validating → Ready` — each tappable.
- **Optimistic updates** where safe (e.g. marking read), with rollback on failure.
- **Streaming** (AI): typing/dots indicator; text streams in.
- **Long operations** (statement import, SAF-T generation, report build): progress with stage labels; allow background continuation + notify on completion.
- **Reduced-motion:** provide a non-animated skeleton/indicator variant.

---

## 22. Accessibility Rules (WCAG 2.1 AA)

- **Contrast:** body text ≥ 4.5:1, large text/UI components ≥ 3:1. **Caution with light-blue on white** — use `blue-600/700` for text and `blue-500+` for component boundaries; verify every text/background pair. White text on `blue-500`, `green-600`, `red-500` meets AA — verify in build.
- **Color never sole signal:** status/confidence always pair icon + text + color. Financial polarity always shows sign/label.
- **Keyboard:** every interactive element reachable and operable; visible focus ring (`blue-500`, 2px + offset); logical tab order; the Review Queue is fully keyboard-driven (A/E/R/→); command palette (Cmd/Ctrl-K).
- **Targets:** ≥ 44×44px hit area (mobile especially), even when the visual is smaller.
- **Labels & semantics:** every field has a programmatic label; errors associated with their field; tables use proper header semantics; icon-only buttons have accessible names; confidence/status have screen-reader text ("confidence high, 96 percent," "status: filed").
- **Motion:** honor reduced-motion; no essential info conveyed by motion alone; streaming/skeletons have static fallbacks.
- **Text:** support up to 200% zoom without loss; don't disable pinch-zoom on mobile; min 12px text.
- **Focus management:** modals/slide-overs trap focus and restore on close; skip-to-content link.
- **Forms:** clear required indicators (not color alone), inline help, generous error messaging.

---

## 23. Bulgarian & English Localization Rules

### 23.1 Language
- **Bulgarian is the default;** English is the secondary. Language toggle (BG|EN) in the top bar; per-user preference; AI responds in the selected language.
- **Cyrillic-first:** enable the font's **Bulgarian `locl`** feature with language tag set to Bulgarian so localized letterforms render; full Unicode storage; never transliterate user data.
- **Fallback chain:** selected language → Bulgarian → English. No missing-string gaps shown to users.

### 23.2 Text & layout
- **Design for variable length** (BG strings differ from EN — sometimes longer); never fix container heights to one language; allow wrapping and ~+30% width tolerance; test both languages in every component.
- **No concatenation** of translated fragments; use whole, parameterized strings (handles grammar/word order).
- **Pluralization** rules per language; **no text baked into icons or images.**
- **Sentence case** in both languages (avoid uppercase, especially Cyrillic).

### 23.3 Number, date & currency formats

| Element | Bulgarian (BG) | English (EN) |
|---------|----------------|--------------|
| Decimal separator | comma `,` | point `.` |
| Thousands separator | space ` ` | comma `,` |
| Example amount | `1 234,56` | `1,234.56` |
| Currency (EUR) | `1 234,56 €` (symbol after, space) | `€1,234.56` |
| BGN reference | `≈ 2 414,32 лв.` | `≈ BGN 2,414.32` |
| Date | `02.06.2026` (dd.mm.yyyy) | `2026-06-02` or `02 Jun 2026` |
| Period | `май 2026` | `May 2026` |

- **Tabular figures** in both locales for alignment.
- Currency symbol placement and separators are **locale-driven**, not hard-coded.
- Fixed rate (1 EUR = 1.95583 BGN) and dual-display window (until 8 Aug 2026) handled by the currency mode (§12.2).

### 23.4 Content
- Plain-language first; pair any unavoidable accounting term with a tooltip definition in both languages.
- Legal/compliance terms keep their official Bulgarian forms (НАП, ЗДДС, КЕП, ЕИК) with EN gloss on first use.

---

## 24. Figma-Ready Component Structure

### 24.1 Token architecture in Figma (Variables)
- **Collection 1 — Primitives:** color ramps (§2.1), spacing scale (§4), radius, type sizes/line-heights as number variables.
- **Collection 2 — Semantic:** roles (§2.2) as variable aliases → primitives. **Components bind only to semantic tokens.**
- **Modes:**
  - *Theme mode:* `Light` (default), `Dark` (future), `White-label` (firm brand override) — swap semantic color values per mode.
  - *Currency mode:* `Dual` (BGN shown) / `Single` (post-Aug-2026) — toggles DualCurrencyAmount's BGN line.
- **Type styles** as Figma text styles per §3.2 (with `tnum` numeric variants noted for handoff).
- **Effect styles** for elevation (§5.4).

### 24.2 Library file structure (pages)
```
00 · Cover & changelog
01 · Foundations        (color, type, spacing, grid, elevation, icons)
02 · Primitives         (buttons, inputs, badges, chips, checkbox/radio/toggle…)
03 · Patterns           (FormField, FilterBar, KPITile, Card, Tabs, Stepper,
                          Modal, SlideOver, Toast, EmptyState, ErrorState, Dropzone)
04 · Domain components  (DocumentViewer, ExtractionFieldRow, AISuggestionBlock,
                          DuplicateCompare, InvoiceLineTable, TotalsPanel,
                          LedgerTable, VatLedgerTable, ReconciliationBoard,
                          DeadlineCard, RiskFeedItem, AiMessage, SubmissionStepper,
                          KepSignPanel, MoneyField, DualCurrencyAmount, VatSelector,
                          AccountPicker, ConfidenceBadge …)
05 · Templates          (AppShell, FirmShell, CompanyWorkspace, ClientPortal,
                          ListPage, DetailSplit, DashboardGrid, Wizard, Workflow)
06 · Mobile             (BottomTabBar, CaptureButton, MobileReviewCard, MobileSheet…)
07 · States library     (empty / error / loading variants gallery)
08 · Icons & illustration
```

### 24.3 Component properties (variants)
Use Figma component properties so one component covers all states:
- **Button:** `variant` (primary/secondary/ghost/danger/commit/link), `size` (sm/md/lg), `state` (default/hover/active/focus/disabled/loading), `icon-leading?` `icon-trailing?` (boolean), `full-width?`.
- **Input/FormField:** `type`, `size`, `state`, `has-label?` `has-helper?` `has-error?` `prefix?` `suffix?`.
- **StatusChip:** `status` (draft/info/processing/warning/success/error), `has-icon?`.
- **ConfidenceBadge:** `tier` (high/medium/low/validated), `show-percent?`.
- **Card/KPITile:** `variant`, `state`.
- **AiMessage:** `role` (user/assistant), `has-citations?` `has-actions?` `streaming?`.
- **Table row / ReviewQueueRow:** `density`, `selected?` `flagged?` `hover?`.
- Slots via **instance-swap properties** (e.g. card body, message body).

### 24.4 Naming conventions
- **Components:** `Group/Name` matching pages — `Primitive/Button`, `Domain/AISuggestionBlock`, `Template/AppShell`.
- **Screen frames (from the UX doc):** `SCR-{AREA}-{NN} · {Name} · {State}` (e.g. `SCR-REV-02 · Single-item Review · Low-confidence`).
- **Areas:** AUTH, ONB, FRM, DSH, DOC, REV, SAL, INV, PUR, BNK, ACC, VAT, CMP, NAP, SAF, KEP, RPT, AI, AUD, SET, PRT.
- **Tokens:** dot-namespaced semantic names (`color.action.primary`, `space-4`, `type.body`).

### 24.5 Build order (recommended)
1. Foundations + token Variables (with modes).
2. Primitives → Patterns.
3. Domain components (especially MoneyField, DualCurrencyAmount, ConfidenceBadge, the review + compliance sets — the system's signature pieces).
4. Templates (AppShell first).
5. Assemble screens from the UX inventory using templates + components.
6. Build the **states library** (every data component: default/loading/empty/filtered-empty/error/permission-denied) per the UX state matrix.
7. QA in **both BG and EN**, light mode, and the dual-currency mode.

---

## Appendix — Quick token reference card

- **Brand colors:** white `#FFFFFF` · light-blue primary `#2F7BE0` (tints `#D6E8FC`/`#EEF5FE`) · success green `#16A463` · neutral text `#12161C` · warning amber `#E39B12` (text `#9A6406`) · error red `#CB2A2A`.
- **Type:** Cyrillic-first sans (Inter / IBM Plex Sans), Bulgarian `locl` ON, `tnum` on all money; body 14/22, KPI 28–32.
- **Spacing:** 4px base (4/8/12/16/24/32/48/64). **Radius:** 6 (controls) / 8 (cards) / 12 (modals).
- **Grid:** 12-col desktop, 240/64 nav rail, 56 top bar, 1200 max content.
- **Confidence:** ≥90 green · 70–89 amber · <70 red · deterministic = validated ✓ (no %).
- **Currency:** EUR primary + BGN reference (≈, muted) until 8 Aug 2026; rate 1.95583; switch via Currency mode.

---

*End of v1.0 design system. Together with the Master Architecture and UX Architecture, this completes the foundation: a designer can build the Figma library from Sections 1–24 and assemble every screen from the UX inventory using these tokens and components.*
