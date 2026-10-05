# Acco: icon integration, Bulgarian-first site, full audit (2026-10-05)

Nothing committed, pushed or deployed. Production (`b6dea51`, English site) and the VPS are untouched; the rollback image `mgi-delta-web:rollback-20261004` was not touched. All work is in the sandbox clone's working tree on `feat/mvp-modules` and is listed file by file in section 13. The report ends with the required status line.

Screenshots (sent with this report): `bg-home-desktop.png`, `en-home-desktop.png`, `bg-mobile-menu-390.png`, `switch-bg-header.png`, `switch-en-header.png`, `switch-bg-focus.png`, `switch-en-focus.png`, `icons-sheet.png` (16/32/48/180/192), `bg-features-desktop.png` (BG inner page), `en-pricing-desktop.png` (EN inner page), `login.png` (product login, icon only changed).

---

## 1. Executive summary

- **Icon**: the supplied PNG (green lowercase "a" with a check in the counter) was vectorised into a single path (viewBox 0 0 1000 1000, 2.1 KB) and is now the one source for the site favicon/SVG icon, the header and footer brand mark, the app icon in the authenticated product (sidebar `AppIcon`, login/register `AccoMark`) and the PNG set 16/32/48/180/192/512. The "acco" wordmark is preserved. The mark is rendered in the existing brand green `#1C6B4E` on the site and white on a brand-green tile in the app and PNG icons. No third-party request is introduced.
- **Language**: the public site is now **Bulgarian by default** at the root URLs; English is complete under `/en`, `/en/features`, `/en/pricing`, `/en/about`, `/en/faq`, `/en/contact`. A restrained **BG / EN** switch sits in the desktop header and at the top of the mobile menu. It is two plain links (no JavaScript, no cookie), so it works without script, preserves the page you are on, and search engines see both trees with `hreflang` alternates, per-language canonical, one sitemap with `xhtml:link` alternates, `og:locale`, and `inLanguage` in the JSON-LD.
- **Copy**: all six pages, navigation, footer, CTAs, aria labels, titles, descriptions, structured data and the 90 or so labels inside the product miniatures were translated into natural Bulgarian (professional register, no transliteration of English idioms; "осчетоводяване", "главна книга", "дневници за покупки и продажби", "ЕИК", "данъчно събитие"). Amounts in the Bulgarian pages use the Bulgarian decimal comma (`228,00 €`), as the product does.
- **Dashes**: no em or en dashes remain in visible marketing copy; the only `–` characters left are numeric ranges (`01.01.2026 – 03.10.2026`, `1–30 дни`, `31–60 дни`), which are legitimate.
- **Colour**: the only raw hex blue in the marketing CSS (`#8FB4E0` for the "AI explanation" dot on the dark statement section) was replaced by the existing `--info` token. The `--info` steel-blue token (`#2C5E97`) is still used as the semantic colour for the third actor ("AI explanation") and for the `extracting`/`open` status pills in the miniatures. This is deliberate semantic colour from the token file, not accidental blue, but it is the one thing in 7C that needs your decision (section 15).
- **Gates** (local production build): generator OK, `tsc` OK, `next lint` 0 warnings, `next build` OK, 27 routes/asset probes as expected, link crawl 19 unique paths with 0 broken and 0 missing anchors across 12 pages + 4 legal pages, 0 overflow at 7 widths × 12 pages, axe-core 0 violations on 13 pages (BG, EN, legal), icon requests 200, login/register/dashboard unchanged apart from the mark.
- **Audit** (read-only): the product's core loop exists and the sacred invariants (RLS, immutable ledger, hash-chained audit, read-only assistant) are implemented and tested. The biggest gaps are security and correctness rather than UI: unauthenticated `GET /dev-storage/*` with the local storage driver in production (anyone with a key can read uploaded documents), seeded demo credentials in production, unguarded `POST /ledger/entries`, DTOs that validate nothing, posting that ignores the invoice date and currency, VAT registers hard-coded to four accounts, and invoice numbering that resets yearly at four digits. Section 11 turns these into a P0 to P3 roadmap.

---

## 2. Logo and icon changes (Part 1)

**Previous state (inspected before touching anything)**
- Site: `public/landing/assets/app-icon.svg` was the pass-2 placeholder mark (forest tile with brass bars); header and footer `.brand` embedded a copy of that SVG inline from the generator; favicon was only that SVG (`<link rel="icon" type="image/svg+xml">`), no PNG fallback, no apple-touch-icon, no manifest.
- App: `components/app/brand.tsx` `AppIcon` = blue `#2F7BE0` rounded square with three bars and a faint check (dashboard sidebar/topbar); `components/app/auth-chrome.tsx` `AccoMark` = `#123A33` tile with brass bars (login/register panel). Two different marks, neither matching the site. `app/layout.tsx` had no `icons` or `manifest` metadata, so the product had no favicon at all (browser default).
- Duplicated logo implementations found: 3 (site generator inline SVG, `AppIcon`, `AccoMark`).

**New state**
- `apps/web/public/landing/assets/icons/acco-mark.path`: the traced path data (the single source for the site). Tracing: `potrace` on the supplied 1000×1000 PNG with a tight threshold; the result was checked visually against the original at 100%, 48 px and 16 px (see `icons-sheet.png`). Counter and check read correctly down to 16 px.
- `acco-mark.svg` (`fill="#1C6B4E"`, transparent background): used as `app-icon.svg` (replaced in place so existing references keep working) and as the SVG favicon.
- PNG set rendered from the vector with Chromium (crisp edges, transparent only where needed): `favicon-16.png`, `favicon-32.png`, `favicon-48.png` (mark on transparent), `apple-touch-icon.png` 180, `icon-192.png`, `icon-512.png` (white mark on green tile, corner radius 20%, opaque as iOS/Android expect).
- `site.webmanifest` (name/short_name "Acco", 192 and 512 icons, `display: browser`, `start_url: /`, theme/background `#FFFFFF`).
- Generator: `LOGO` is now `<svg viewBox="0 0 1000 1000"><path fill="currentColor" …>` read from `acco-mark.path` at build time; `.brand svg { color: var(--brand) }` in `site.css` colours it. The head of every generated page has `icon` (SVG + 32 PNG), `apple-touch-icon` and `manifest` links; the Organization JSON-LD `logo` now points to `icon-512.png` (a raster, as schema.org recommends).
- App: new `components/app/acco-mark.tsx` exports `ACCO_MARK_PATH` and `AccoMarkTile` (green tile, white mark; `role="img"`, `aria-label`). `AppIcon` and `AccoMark` now render `AccoMarkTile`; their props, sizes and the wordmarks ("Счетоводство", "Acco" in Newsreader) are unchanged. `app/layout.tsx` gains `icons` and `manifest` metadata only; title and description unchanged. The three implementations are now one vector in two files (path string in `.path` for the generator, the same string in `acco-mark.tsx` for the app; the file header says to keep them in sync).
- Accessibility: header/footer brand links keep `aria-label="Acco"` with the SVG `aria-hidden`; app marks expose a label. Contrast of the green mark on white and the white mark on green both exceed 4.5:1.
- Not done on purpose: no change to the marketing design, no dashboard redesign, no functional change, no OG image (still no social image; see decisions).

---

## 3. Baseline (production and repo state at start)

- Production: `https://app.185-52-207-143.sslip.io/`, single VPS, Caddy → `web:3001` (Next 14 standalone) and `/api/*` → `api:3000`; deployed HEAD `b6dea51a5ada8dea4dfefd1df3f14f30f2cc78b7` (`feat(web): replace public marketing site`), rollback image tagged. Verified live before this pass: `/` English site, `/api/health/ready` ok.
- Sandbox clone: `feat/mvp-modules` at `b6dea51`, working tree clean before starting (0 entries). Backup branch `backup/pass1-app-redesign-2026-10-04` = `c466e23` on origin, untouched.
- Product login page (untouched product) still shows the seeded demo credentials box (`demo@demo.bg / Demo1234!`) and "EUR · EU · Хостинг в ЕС" in the footer. Both are product scope, reported in sections 9 and 11.

---

## 4. Architecture notes and the localisation route decision

**Site generation**: `apps/web/scripts/build-landing.mjs` (one file, ~1 500 lines) holds a shared `DICT = { en, bg }` dictionary and one set of page builders that receive a language context `{ L, T, p, m }` (language, dictionary, URL prefix, money formatter). Every string the visitor can read, including aria labels, `<title>`, meta description, `og:*`, JSON-LD and the labels inside the product miniatures, comes from the dictionary; no string is hard-coded in the builders. Output: `public/landing/*.html` (BG) and `public/landing/en/*.html` (EN), `public/sitemap.xml` (12 URLs with alternates), `public/robots.txt`. Legal pages stay Bulgarian templates (noindex, placeholders) and are linked from both trees.

**Route strategy decision**: *Bulgarian at the root, English under `/en`, as path-prefixed static pages served through `next.config.mjs` `beforeFiles` rewrites.*
- Why path prefix and not a cookie/JS toggle: the brief requires that switching never breaks URLs, anchors, metadata, canonical, sitemap or indexing. Two real URL trees are the only option where every language state has a stable, linkable, indexable URL and no script is needed; `hreflang` and canonical are well defined; a visitor can bookmark `/en/pricing`.
- Why BG at root and not `/bg`: the default audience is Bulgarian, the product is Bulgarian-first (CLAUDE.md §1), existing production URLs (`/`, `/features`…) keep working and simply change language, and `x-default` points to the Bulgarian tree.
- Why no automatic language detection: Accept-Language redirects break crawlers and shared links; the switch is one click and the choice is carried by the URL. If you later want persistence, the right place is a tiny cookie read by Caddy or middleware, not the generator.
- The switch keeps the page: `/features` ⇄ `/en/features`, `/` ⇄ `/en`. Anchors (`/#how`, `/#ai-accountant`) are language-prefixed in the nav so they resolve in both trees. App links (`/login`, `/register`) are shared and unprefixed.
- Metadata per page: `<html lang>`, `canonical` (own URL), `alternate hreflang="bg"`, `hreflang="en"`, `hreflang="x-default"` (BG), `og:locale` + `og:locale:alternate`, JSON-LD `inLanguage`. Sitemap has `xhtml:link` alternates on all 12 entries.
- Product routing untouched: `/login`, `/register`, `/dashboard`… are Next pages; `/api/*` is Caddy's. Two new rewrite lines only.

**Product architecture** (from the backend audit, unchanged): NestJS modular monolith with transaction-scoped `SET LOCAL` tenant context, PostgreSQL RLS on tenant tables (fail-closed, tested), ledger triggers enforcing balance and immutability, hash-chained audit table, BullMQ workers for extraction/suggestions, S3-compatible or local storage, deterministic rules engine, deterministic read-only assistant with mandatory citations. Next 14 client-rendered app with localStorage token.

---

## 5. Feature reality matrix (Part 2, areas A to Q)

Classification: **WORKING** · **NEEDS VALIDATION** (implemented, not proven) · **PARTIAL** · **PLACEHOLDER/MOCK** · **PLANNED** · **MISSING** · **UNKNOWN**. Evidence is file-level from the repository at `b6dea51`.

| Area | Status | Evidence and caveats |
|---|---|---|
| A. Auth (email/password, JWT) | **PARTIAL** | Login/register/refresh exist; JWT signer reads `AUTH_JWT_SECRET ?? 'dev-only-not-for-prod'` while env validation checks `JWT_SECRET` (mismatch: a deploy can validate green and still sign with the dev secret). 15-minute sessions; refresh endpoint unusable after expiry. No password reset. MFA: schema only, no enrolment or UI. Google OAuth: no `state` validation, `email_verified` ignored. |
| B. Tenancy / RLS | **WORKING** | `SET LOCAL` per request/job, RLS policies in migrations, fail-closed when no context, isolation tests in CI. Migration 0040 re-owns `register_account/oauth_account` to the superuser (reverts 0021): CI registration test should fail; NEEDS VALIDATION on the live DB. |
| C. Roles / permissions | **PARTIAL** | Role decorators on most routes, but `POST /ledger/entries`, `/ledger/entries/:id/reverse`, `GET /ledger/entries`, `POST /companies`, `/identity/*`, `PUT /dev-storage/*` have no permission decorator (viewer can post directly). VAT build/return writes need only `VAT_READ`. |
| D. Document upload / storage | **PARTIAL** | Upload with type/size validation (25 MB), immutable versions, trash/restore, audit. Production uses `STORAGE_DRIVER=local` and `GET /dev-storage/*` is **unauthenticated** (HIGH). Malware scan returns `clean` when `AV_SCAN_URL` is unset (permissive default). MinIO Object Lock bucket exists but is unused; local "WORM" is in-memory. |
| E. Extraction (PDF text / XML) | **WORKING** | Native text-layer PDF and XML parsing, field confidence, diagnostics, EIK checksum, VAT format, IBAN mod-97 validators with tests. |
| F. OCR (scans/photos) | **NEEDS VALIDATION** | Azure Document Intelligence adapter with EU-region enforcement, enabled per deployment; OCR fixtures folder empty; accuracy runbook + scoring tool exist, no labelled set. Correctly marked beta on the site. |
| G. Suggestions / rules engine | **PARTIAL** | Account/category/VAT proposal from rules + per-supplier memory, versioned rule cards. Unmatched suppliers are treated as BG; intra-EU purchases get VAT deducted as if domestic; `company_settings.vat_registered` defaults false and no UI sets it, so purchase suggestions get treatment `none` until someone flips it in the DB. All rule cards are "unreviewed". |
| H. Review queue / approval | **WORKING** (with a bug) | Side-by-side document/fields, corrections, regenerate, approve/reject, audit. The computed review state machine result is discarded (`review.service.ts:111`), so invalid transitions are not blocked. Queue ordered newest-first, not by attention. Steps extraction → suggestion → review → post are separate manual clicks. |
| I. Ledger / posting | **WORKING** (correctness bug) | Balanced, append-only, reversal-only corrections, locked-period refusal, DB triggers, property tests. But `posting.service.ts:88` posts with **today's date and hard-coded EUR**, ignoring the invoice's tax-event date and currency. |
| J. Accounting periods | **WORKING** | Lock/unlock with role, posting refused into locked period, tested. |
| K. Invoicing | **PARTIAL** | Sequential numbering, proforma, credit/debit notes, catalogue with VAT codes, Cyrillic PDF on issue. Numbering is `YYYY-0001` (4 digits, yearly reset), not the 10-digit continuous series ЗДДС requires. Email path claims an attachment but none is attached; PDF not persisted under the S3 driver. Download/send from the app: PLANNED (labelled so on the site). |
| L. Bank import / reconciliation / payments | **WORKING** | CSV/XLSX import with duplicate detection, ranked match suggestions, confirm → payment posting, reversals. Bank-account currency EUR only. |
| M. Receivables / payables / ageing | **WORKING** | Open items and ageing from posted entries. |
| N. VAT registers / summary / VIES | **PARTIAL** | Purchase/sales registers and period summary computed from the ledger, but keyed on hard-coded accounts 4531/4532/401/411, ignoring approved `vat_suggestions`; reversed entries stay in registers; immutable register rows cannot be rebuilt. Golden cases cover the standard rate only. VIES is a format check unless `VIES_API_URL` is set. NRA return file export (DEKLAR/POKUPKI/PRODAGBI): MISSING, labelled planned. |
| O. SAF-T | **PARTIAL (beta)** | Dataset build + internal validation; XML export behind `SAFT_XML_ENABLED` (off in the deploy env); no official XSD. Site says exactly this. |
| P. Reports | **WORKING** | Trial balance, P&L, balance sheet, GL, monthly revenue/expenses, cash flow; CSV only for the three monthly reports. |
| Q. AI assistant | **WORKING** | Deterministic, fixed question set, mandatory citations, abstains, read-only, audited. `/assistant` page exists on the deployed branch. Users without the role see 403 (pass-1 branch surfaces it as "не е наличен"). |
| Audit trail | **WORKING** | Hash-chained, every state change, verify endpoint. |
| Ops / infra | **PARTIAL** | Docker compose on one VPS, Caddy TLS, local `pg_dump` backups 14 days (documents/`doc_data` not backed up), `/metrics` behind auth, only a global 300/min throttle, CI e2e does not cover upload → extract → review → post. |

---

## 6. Workflow trace (Part 4): purchase invoice from a Bulgarian supplier, upload to VAT register

Traced for a PDF invoice with a text layer (the path marketed as "available"; OCR is beta).

1. **UI** `app/(app)/upload/page.tsx` → `POST /documents/upload` (multipart). **API** `documents.controller.ts` validates MIME/size (25 MB), calls `StorageService.put` (local driver in production → `apps/api/storage/...`), inserts `documents` + `document_versions` (RLS-scoped), writes `audit_events` (hash chain), enqueues `extract` job. **Tests**: unit tests for validation; e2e covers upload only. Malware hook: `clean` without `AV_SCAN_URL`.
2. **Worker** `extraction.processor.ts` → `pdf-parse` text layer → `field-extractor.ts` (regex/heuristics per field with confidence) → validators (`eik.ts` checksum, `vat-number.ts` format, `iban.ts` mod-97) → `extractions` row with diagnostics. Status `extracted`. **Tests**: validator unit tests, extractor fixtures (text PDFs only; OCR fixtures empty).
3. **Suggestion** is *not* automatic: the user clicks "Generate suggestion" in `review/[id]` → `POST /suggestions/:documentId` → `rules.engine.ts` resolves supplier (EIK lookup; unmatched ⇒ assumed BG), VAT treatment (`company_settings.vat_registered` false by default ⇒ `none`), accounts from category rules + `counterparty_memory`. Persists `ai_suggestions` with rule-card versions and audit (actor `ai:suggestions`). **Tests**: rules unit tests; VAT golden cases standard rate only.
4. **Review** `review/[id]/page.tsx` shows document (signed URL from `/dev-storage/*`, which is unauthenticated), fields, suggestion. Edit → `PATCH /reviews/:id/fields`; approve → `POST /reviews/:id/approve` (role `REVIEW_APPROVE` checked on server). The state machine computes the next state but the result is dropped (`review.service.ts:111`), so the row is updated regardless of transition validity. Audit written.
5. **Post** another click → `POST /postings/from-review/:id` → `posting.service.ts` builds lines from the approved suggestion, **date = today, currency = 'EUR' literal** (line 88), calls the ledger posting service → `journal_entries` + `journal_lines` insert inside one transaction with the audit row; DB trigger checks Σdebit = Σcredit and period lock; UPDATE/DELETE blocked by trigger. **Tests**: ledger property tests, period lock tests. Not covered: the review→posting handoff in e2e.
6. **VAT register** `GET /vat/registers?period=2026-09` → `vat-register.service.ts` selects journal lines on accounts 4531/4532/401/411 for the period, ignoring the approved treatment on `vat_suggestions`; a reversed entry and its reversal both appear. Period summary derives output − input. VIES dataset built from intra-EU lines. **Tests**: register unit test with one standard-rate case.
7. **Reports / assistant** read from projections of the same ledger; the assistant cites the entry id and register row.

Connected end-to-end: yes, every step has UI, API, service and persistence, and the invariants hold. Weak links: three manual clicks where the marketing (correctly) says "proposes"; posting date/currency; register account coupling; unauthenticated document reads.

---

## 7. Marketing claim audit (Part 5)

Statuses: **OK** (backed by code), **OVERSTATED**, **FIXED** (copy changed in this pass), **INFO** (illustrative, acceptable).

| Claim (current copy, BG/EN) | Evidence | Status | Risk | Wording now / recommended |
|---|---|---|---|---|
| Nothing posted without a person; human approval on every document posting | review approve role check; no auto-post path | **OK** with caveat | Medium: `POST /ledger/entries` is unguarded, so a *viewer* can post via API; the claim is true of the UI flow, not of the API | Keep; fix the endpoint (P0) |
| Immutable ledger, corrections by reversal | triggers + tests | OK | Low | Keep |
| Hash-chained audit trail, verifiable | audit module + verify endpoint | OK | Low | Keep |
| Isolation per company at the DB level; request outside context refused | RLS + fail-closed | OK | Low | Keep |
| Roles checked on the server | most routes | OVERSTATED for ledger/companies/identity routes | Medium | Keep wording, fix routes (P0) |
| EIK checksum, VAT-number format, IBAN mod-97 by validators | validators + tests | OK | Low | Keep |
| VAT treatments proposed: 20%, 9%, 0%, intra-EU, import | rules engine enum `none/standard/reduced/zero/intra_community/import` | **FIXED** (was "from 20% to intra-EU acquisitions" plus "exempt" earlier) | Low | As now |
| "resolved as of the tax-event date" | posting uses today | **FIXED** (removed) | Would have been HIGH | Removed; do not reintroduce until posting uses the invoice date |
| VAT registers and period summary computed from the ledger | yes, but account-coded | OK | Medium (correctness, not honesty) | Keep |
| VIES dataset; live VIES lookup configurable per deployment | format-only without `VIES_API_URL` | **FIXED** (caveat added) | Low | As now |
| SAF-T dataset and validation (beta); XML enabled per deployment; official schema planned | matches flags | **FIXED** | Low | As now |
| OCR for photos/scans, EU provider, region enforced, beta | adapter + region guard; no accuracy evidence | OK as beta | Low | Keep beta label until the labelled set exists |
| Invoice PDF generated on issue; download/sending planned | PDF on issue (not persisted under S3); email sends no attachment | **FIXED** (sending moved to Planned) | Low | As now |
| CSV export for the monthly reports | 3 reports | **FIXED** (was "CSV export") | Low | As now |
| Queue of documents awaiting review | newest-first | **FIXED** (was "ordered by attention") | Low | As now |
| Low-confidence fields highlighted | threshold 85% server vs miniature showing 71% | INFO | Low | Fine (71% is below either threshold) |
| Malware scanning | removed from copy | FIXED | Low | Do not claim until `AV_SCAN_URL` is mandatory |
| Up to 25 MB | matches | FIXED | Low | As now |
| "Read-only by design" | capability-limited identity | OK | Low | Keep |
| Versioned rule cards with legal reference; cards awaiting review lower confidence | cards exist, all unreviewed | OK but note | Low | Keep; have an accountant review the cards (P2) |
| Miniatures: `#417`, 94% confidence, 1 284 events, named people | illustrative | INFO | Low | Scene has `aria-hidden` and is labelled as the review screen; fine |
| "Hosted in the EU" | not verifiable | Removed in the previous release | n/a | Product login footer still says "Хостинг в ЕС" (product scope) |

No claim about customers, numbers, certifications or integrations exists on the site.

---

## 8. Pass-1 branch audit (Part 3): `backup/pass1-app-redesign-2026-10-04` (`c466e23`)

1. **What it changes**: 76 frontend files (+3 188 / −2 584) under `apps/web/app`, `components`, `lib`, plus 4 non-frontend additions (`scripts/dev-stack.ps1`, `tools/local-ocr/*`). `apps/api` identical to production.
2. **Visual-only?** No. About two thirds is visual (tokens, `globals.css`, Tailwind config, all `components/ui/*`, shell, sidebar, topbar, page layouts). The rest changes behaviour (3 to 6).
3. **Behaviour changes**: localStorage keys renamed `mgi.*` → `acco.*` (forces every user to log in again and loses saved preferences); review page derives posted state from `Endpoints.postingForReview` (a real fix); document preview via blob fetch (depends on storage CORS; breaks with the S3 driver unless configured); review edit gating by state; dashboard hard-coded 2026-06 dates replaced by runtime dates, VAT banner gated to day ≤ 14; posting/reports default range year-start..today with explicit Apply; client-side filters and pagination; invoice VAT% select; nav regrouped into 8 groups; `lib/i18n` marketing subtree deleted; login default email removed; Pagination component hard-coded Bulgarian.
4. **Auth**: no change to auth logic; only the storage-key rename, which has the re-login side effect.
5. **Currency**: BGN display was already gone on the deployed branch; the branch only deletes a dead helper. Bank-account currency select becomes EUR-only.
6. **/assistant**: page exists on the branch and on production; the branch adds an error panel ("не е наличен") that users without the role will see on 403.
7. **Backend dependency**: none new; every endpoint it calls exists. `tsc` passes on the branch.
8. **Reusable as is**: tokens, `globals.css`, Tailwind config, all `components/ui` primitives, shell/sidebar/topbar, visual-only pages. Needs rework before reuse: key rename (migrate instead), bundled dashboard logic, date-range defaults, assistant error visibility, blob preview (CORS), the non-frontend files.
9. **Discard**: `scripts/dev-stack.ps1`, `tools/local-ocr/*` (out of scope for the web app), the i18n deletion (decide separately).
10. **If shipped as is**: all users logged out once, lost UI preferences, document preview possibly broken on S3 deployments, non-admin users see an assistant error panel, and a mixed palette (the branch keeps a blue primary). Recommendation: do not merge; cherry-pick in the product UI pass (section 12, pass 2) in three PRs: tokens/primitives, shell/nav, pages, with a key-migration shim.

---

## 9. Production readiness and security review (Part 6, non-destructive)

Ordered by severity. "Fix" is the proposed change, not done.

| # | Severity | Finding | Fix |
|---|---|---|---|
| S1 | **HIGH** | `GET /dev-storage/*` has no auth guard; production runs `STORAGE_DRIVER=local`, so uploaded documents and invoice PDFs are readable by anyone who knows or guesses a key. | Guard the route (session + tenant check) or serve files only through short-lived signed URLs; move production to MinIO/S3 with signed GETs. |
| S2 | **HIGH** | Demo credentials `demo@demo.bg / Demo1234!` seeded in production by `deploy-sofia.sh`, printed on the login page; CMS site owner seeded by migration 0022. | Remove seed in prod, rotate/delete the demo user, remove the login box. |
| S3 | **HIGH** | `POST /ledger/entries`, `/reverse`, `GET /ledger/entries`, `POST /companies`, `/identity/*`, `PUT /dev-storage/*` without permission decorators. | Add role guards; add a test that every mutating route has one. |
| S4 | **HIGH** | All DTOs are TypeScript interfaces; `ValidationPipe` validates nothing. | Convert to class-validator DTOs (or zod pipes) per module, starting with auth, documents, ledger. |
| S5 | **MEDIUM** | JWT secret env mismatch (`AUTH_JWT_SECRET` vs validated `JWT_SECRET`) with a dev fallback. | Single variable, no fallback, fail start if missing. |
| S6 | MEDIUM | Google OAuth without `state`; `email_verified` ignored. | Add state/nonce; require verified email. |
| S7 | MEDIUM | Malware scan permissive when `AV_SCAN_URL` unset. | Fail closed in production. |
| S8 | MEDIUM | VAT build/return writes need only `VAT_READ`. | Require a write role. |
| S9 | MEDIUM | Migration 0040 reverts ownership hardening of 0021. | Verify on prod; re-apply. |
| S10 | MEDIUM | Backups: local `pg_dump`, 14 days, on the same VPS; documents not backed up. | Off-host backups incl. storage; restore drill. |
| S11 | LOW | Global throttle only (300/min); no per-account login throttling. | Per-route limits on auth. |
| S12 | LOW | No password reset; MFA not enrollable; refresh unusable after expiry. | Product work (P1). |
| S13 | LOW | Product login footer "Хостинг в ЕС" is an unverified claim inside the product. | Change text in the product pass. |

Web image (this pass): no new runtime dependency, no new env variable, static assets only, two rewrites. Deploy path unchanged (`compose build web` + `up -d --no-deps web`), rollback unchanged.

---

## 10. Bugs found (code, not design)

1. `posting.service.ts:88`: journal date = today, currency literal `EUR`; ignores the invoice tax-event date and currency. Accounting correctness.
2. `review.service.ts:111`: state machine output computed and discarded; invalid transitions allowed.
3. `vat-register.service.ts`: registers keyed on 4531/4532/401/411 and ignore approved `vat_suggestions`; reversed entries remain in registers; immutable register rows cannot be rebuilt after a correction.
4. Rules engine: unmatched supplier ⇒ BG; intra-EU purchase gets input VAT deducted without reverse charge.
5. `company_settings.vat_registered` defaults false with no UI ⇒ every purchase suggestion `treatment: none`.
6. Invoice numbering `YYYY-0001`: 4 digits, resets yearly; ЗДДС requires a continuous 10-digit series.
7. Invoice email says "attached" but sends no attachment; PDF not persisted with the S3 driver.
8. Low-confidence threshold: server 85%, older copy 70% (copy fixed; align the product's hint text).
9. Queue sort newest-first (copy fixed).
10. Dashboard hard-coded 2026-06 dates on the deployed product (pass-1 branch fixes it).
11. Product has no favicon (fixed in this pass via metadata).

---

## 11. Roadmap P0 to P3 (Part 8)

Categories: **SEC** production security · **ACC** accounting correctness · **FUNC** missing functionality · **PUI** product UI polish · **MKT** marketing polish.

### P0 (before any real company data)
| Item | Cat. | Problem / evidence | Risk | Work | Files | Deps |
|---|---|---|---|---|---|---|
| Guard document reads | SEC | S1 | Data exposure | 0.5 d | `storage/dev-storage.controller.ts`, storage service, review/upload pages (signed URLs) | none |
| Remove demo seed from prod | SEC | S2 | Account takeover of demo tenant | 0.5 d | `infra/deploy-sofia.sh`, migration/seed, `login/page.tsx` | none |
| Role guards on unguarded routes | SEC | S3 | Viewer can post | 0.5 d | ledger/companies/identity controllers + route-guard test | none |
| JWT secret single source | SEC | S5 | Dev secret in prod | 0.25 d | `auth/jwt.ts`, `config/env.ts`, `.env.deploy` | redeploy |
| Request validation | SEC | S4 | Injection/garbage data | 2 d | DTOs per module | none |

### P1 (correctness of the books)
| Item | Cat. | Problem | Work | Files | Deps |
|---|---|---|---|---|---|
| Posting date/currency from the document | ACC | bug 1 | 1 d | `posting.service.ts`, suggestion schema | none |
| Review state machine enforced | ACC | bug 2 | 0.5 d | `review.service.ts` + tests | none |
| Registers from approved treatment; exclude reversed pairs | ACC | bug 3 | 2 d | `vat-register.service.ts`, `vat_suggestions` join, rebuild path | P1 posting |
| Reverse-charge for intra-EU; supplier country from VAT prefix | ACC | bug 4 | 1 d | `rules.engine.ts`, golden cases | accountant review of cards |
| `vat_registered` in company settings UI + onboarding | FUNC | bug 5 | 0.5 d | `settings/page.tsx`, companies service | none |
| Invoice numbering 10-digit continuous | ACC | bug 6 | 1 d | `invoicing/numbering.ts`, migration | sign-off (ADR) |
| VAT golden cases 9/0/exempt/RC/intra-EU | ACC | tests | 1 d | `test/vat/*` | accountant |
| Core-loop e2e upload→post→register | ACC | CI gap | 1 d | `e2e/*` | none |

### P2 (product completeness)
| Item | Cat. | Work | Files |
|---|---|---|---|
| Password reset, MFA enrolment, refresh flow | FUNC | 3 d | auth module, profile page |
| Invoice PDF download + email with attachment, persist PDF | FUNC | 1.5 d | invoicing service, mailer, invoices page |
| NRA return export (DEKLAR/POKUPKI/PRODAGBI) | FUNC | 3 d | vat module |
| Off-host backups incl. documents, restore drill | SEC | 1 d | infra scripts |
| Fail-closed malware scan, OAuth state | SEC | 1 d | documents, auth |
| OCR accuracy set + eval run | FUNC | 2 d + data | `tools/extraction-eval` |
| Rule cards reviewed by an accountant | ACC | review | `rules/cards/*` |

### P3 (polish)
| Item | Cat. | Work |
|---|---|---|
| Product UI pass: Acco palette (ink/green/warm), one brand mark, remove blue primary, Google Fonts import, gradients/glass; cherry-pick pass-1 tokens/primitives/shell | PUI | 4 d |
| App favicon/manifest already done; add OG image for the site; real domain and contact channel | MKT | 1 d |
| Queue sorting by attention; confidence hint text 85% | PUI | 0.5 d |
| SAF-T official XSD + XML on | FUNC | 2 d + XSD |

**Product vs marketing colour (7D)**: the app's primary is blue `#2F7BE0` (HSL 214 74% 53%) with cool-grey surfaces, a Google Fonts import (Inter + Newsreader), gradient/glass/aurora utilities and 53 blue usages; login/register use a third palette (cream, forest, brass, serif). The site uses ink `#0C1210`, green `#1C6B4E`, warm neutrals and hairlines. A future product pass would change: `app/globals.css` `:root`/`.dark` tokens (primary → green family, surfaces → warm neutrals, remove gradient utilities), `tailwind.config.ts`, `components/ui/button.tsx` variants, `components/app/brand.tsx` wordmark (already shares the mark), `app/login` and `app/register` chrome (drop cream/brass/serif, keep the mark), sidebar/topbar, and self-host fonts. Not touched in this pass by instruction; the only app change is the mark itself, which now reads green inside a blue UI. That is visible and intentional (section 15, decision 2).

---

## 12. Recommended next 3 passes

1. **Security and correctness pass (P0 + the ACC half of P1)**: API only, no UI changes except the settings field and removing the demo box. One week. Ships with route-guard tests, DTO validation, posting date/currency, review state machine, register fix. This is what makes the marketing claims true at the API level.
2. **Product UI pass**: bring the app onto the Acco tokens, one mark, self-hosted fonts, cherry-pick the safe parts of pass-1 in three PRs (tokens/primitives, shell/nav, pages) with a localStorage key-migration shim; fix dashboard dates, queue sort, assistant 403 state, confidence hint. One to two weeks.
3. **Compliance pass (P1 rest + P2 VAT)**: invoice numbering, reverse charge, golden cases, NRA export, invoice PDF/email, OCR eval set, accountant review of rule cards, SAF-T XSD. Two to three weeks, needs the accountant.

Marketing can then follow with: real domain + contact channel, OG image, screenshots of the real (recoloured) product replacing the miniatures where you want.

---

## 13. Exact files changed in this pass (30 files, +2 591 / −1 010)

Icon (Part 1):
- `apps/web/public/landing/assets/app-icon.svg` (replaced: new mark, green on transparent)
- `apps/web/public/landing/assets/icons/acco-mark.path` (new, path data)
- `apps/web/public/landing/assets/icons/acco-mark.svg` (new)
- `apps/web/public/landing/assets/icons/favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (new)
- `apps/web/public/landing/assets/icons/site.webmanifest` (new)
- `apps/web/components/app/acco-mark.tsx` (new: `ACCO_MARK_PATH`, `AccoMarkTile`)
- `apps/web/components/app/brand.tsx` (`AppIcon` body → `AccoMarkTile`; API unchanged)
- `apps/web/components/app/auth-chrome.tsx` (`AccoMark` body → `AccoMarkTile`; API unchanged)
- `apps/web/app/layout.tsx` (`metadata.icons` + `metadata.manifest` added; nothing else)

Localisation, switch, dashes, colour (7A to 7C):
- `apps/web/scripts/build-landing.mjs` (bilingual generator)
- `apps/web/public/landing/{index,features,pricing,about,faq,contact}.html` (regenerated, now Bulgarian)
- `apps/web/public/landing/en/{index,features,pricing,about,faq,contact}.html` (new, English)
- `apps/web/public/landing/assets/site.css` (`.lang`, `.lang-desktop`, `.lang-mobile`, `.mm-lang`; `.brand svg` colour; `#8FB4E0` → `var(--info)`)
- `apps/web/public/sitemap.xml` (12 URLs with alternates)
- `apps/web/next.config.mjs` (+2 rewrite lines for `/en` and `/en/:page`)

Not changed: `tokens.css`, `site.js`, legal pages, `robots.txt` (regenerated identical), anything under `apps/api`, auth, DB, Caddy, compose, env.

Proposed commit (not made): `feat(web): Acco icon, Bulgarian-first site with EN under /en` on `feat/mvp-modules`, single commit, web-only deploy as before.

---

## 14. Build and test results (Part 7)

| Gate | Result |
|---|---|
| `node scripts/build-landing.mjs` | OK, 12 pages |
| `npx tsc --noEmit` (clean `.next`) | OK |
| `npx next lint` | 0 errors, 0 warnings |
| `npx next build` (production API URL baked) | OK |
| `next start` route probes | 12 marketing routes 200 (`text/html`), `/login` `/register` `/dashboard` 200, `/sitemap.xml` 200 `application/xml`, `/robots.txt` 200, 7 icon files 200 with correct types, `site.webmanifest` 200 `application/manifest+json`, `/admin` and `/en/nope` 404 |
| `<html lang>` / `<title>` / canonical | `/` → `bg`, Bulgarian title; `/en/pricing` → `en`, canonical `/en/pricing`; product `/login` head now has icon, 32-PNG, apple-touch-icon and manifest links |
| Link crawl (12 pages + 4 legal) | 19 unique paths, 0 broken, 0 missing anchors |
| Browser asset requests on `/`, `/en`, `/login` | only self-hosted fonts and `app-icon.svg`; 0 external requests |
| Overflow | 0 of 84 (12 pages × 1440/1280/1024/768/430/390/375) |
| Language switch | all 12 pages: current language marked `aria-current`, other language is a link with `hreflang` to the same page in the other tree, mobile and desktop switch identical, alternates correct |
| Mobile menu (390) | switch visible at top, all targets ≥ 44 px, desktop switch hidden, opens/closes, Escape returns focus |
| axe-core (wcag2a/aa/21aa/best-practice) | 0 violations on 13 pages (6 BG, 6 EN, 1 legal); heading order sane |
| Em/en dash scan | 0 in prose; remaining `–` only in `01.01.2026 – 03.10.2026`, `1–30`, `31–60` ranges (BG and EN) |
| Stale strings (`mailto`, `acco.bg`, `hello@`) | 0 |
| Raw hex in `site.css` | only `#fff`, `#000`, warm greys; no blue |
| Product pages visually | login/register/dashboard unchanged apart from the mark (screenshot `login.png`) |

---

## 15. Decisions needed from you

1. **`--info` blue for the "AI explanation" actor and the `extracting`/`open` pills.** Keep as a semantic third colour (current), or replace with an ink-outlined/neutral marker so the site is strictly ink + green + warm. Both are one CSS change; I kept the token because it is in `tokens.css` and distinguishes the three actors without using green twice.
2. **Green mark inside the blue app.** The app now shows the new mark on a green tile beside a blue UI until the product UI pass. Alternative: keep the old blue `AppIcon` in the dashboard until that pass (one-line revert in `brand.tsx`). I recommend keeping the new mark: one brand, and the product pass is next anyway.
3. **Open Graph image.** None exists; social shares show no picture. A 1200×630 image from the mark and wordmark is a 20-minute task if you want it in this commit.
4. **`x-default` = Bulgarian.** Confirm. (If you expect more foreign than Bulgarian traffic, `x-default` → `/en`.)
5. **Legal pages** remain Bulgarian-only placeholders (noindex) and are linked from the English tree with a note. Confirm, or ask for English legal templates later.
6. **Commit now?** Everything in section 13 is ready as one commit; push and deploy follow the same web-only procedure as the previous release.

**READY FOR ICON COMMIT — AUDIT COMPLETE**
