# PROJECT_HANDOFF_v1

**Project:** Счетоводство — AI Accounting Platform (Bulgarian-first, EUR-native)
**Purpose of this file:** hand off all context so work can continue in a fresh chat with zero loss.
**Date:** 2026-06-03 · **Repo:** `C:\Users\Cody\Desktop\MGI-Delta` · **Branch:** `main`
**Sources of truth (read on conflict):** `AI_ACCOUNTING_PLATFORM_MASTER_v1.md` → `CLAUDE.md` → the 11 `AI-Accounting-Platform-*.md` architecture docs → this file.

> **Read order for a new agent:** (1) `CLAUDE.md` (operating contract + the 10 invariants + §15 NEVERs), (2) this file, (3) `local-dev-stack` memory note, (4) cite the architecture docs instead of re-deriving.

---

## 1. Product vision
An AI-powered, **Bulgarian-first** accounting platform for small businesses, freelancers and accountants. The entire MVP is **one trustworthy loop**:

`upload document → AI extracts → human reviews → approves → immutable double-entry posting → VAT registers + reports (exported for manual NRA filing)`

Sacred from day one: **RLS tenant isolation, the immutable ledger, the append-only audit trail, human control of money & the state.** The AI **proposes**; a human **approves**; the ledger is **immutable**; every change is **audited**.

## 2. Business goals
- Replace manual invoice data-entry + bookkeeping with an AI-assisted, **deterministic-validated** loop that an accountant can trust.
- Bulgarian compliance: VAT registers (purchase/sales) + СД return dataset; **EUR functional currency, BGN reference** (fixed 1 EUR = 1.95583 BGN) through 8 Aug 2026.
- EU-resident, zero-retention AI. Never auto-file or auto-post in MVP.
- Pilot-ready: a real company can run upload→…→reports end-to-end.

## 3. Target users
- **Small business owners / freelancers** — upload invoices, see VAT owed, issue sales invoices.
- **Accountants / bookkeepers** — review queue, approve postings, run trial balance / P&L / VAT.
- Roles (RBAC): tenant `tenant_admin`/`member`; company `owner`/`accountant`/`approver`/`viewer`.

---

## 4. Architecture summary
| Layer | Choice |
|---|---|
| Backend | **NestJS** (TypeScript strict) — modular monolith, 11 bounded contexts |
| Frontend | **Next.js 14** (App Router) + React + **Tailwind + shadcn-style** design system |
| DB | **PostgreSQL 16** — RLS (FORCE), immutable ledger triggers, hash-chained audit |
| Cache/queue | **Redis + BullMQ** (scan + extraction consumers in a separate worker process) |
| Storage | S3-compatible (prod, Object-Lock/WORM); **local-disk dev adapter** now |
| OCR | pdfjs (born-digital) + EU zero-retention vendor (pluggable) + deterministic dev OCR |
| Auth | email+password (argon2id) + JWT access + rotating refresh; **Google OAuth** (config-gated) |
| State/data | TanStack Query (server state) · RHF + Zod (forms) · next-intl-ready (BG) |

**Request flow:** Browser → Next (client-rendered, calls API with `Authorization: Bearer` + `X-Company-Id`) → NestJS (`TenantContextMiddleware` sets tenant from the signed JWT + authorizes the company header) → Postgres via `app_user` (RLS, `SET LOCAL app.tenant_id/company_id`). Worker re-applies context from job payloads.

Full detail: `AI-Accounting-Platform-Architecture.md`, `…-Backend-Architecture.md`, `…-Frontend-Architecture.md`, `…-Domain-Model-Data-Architecture.md`.

## 5. Monorepo structure
npm workspaces (`apps/*`). pnpm-workspace.yaml is vestigial.
```
MGI-Delta/
├─ apps/
│  ├─ api/          NestJS modular monolith (255 .ts files)
│  │  ├─ src/
│  │  │  ├─ main.ts            HTTP bootstrap (helmet, CORS allow-list, ValidationPipe, shutdown)
│  │  │  ├─ worker.ts          BullMQ consumer host (scan + extraction)
│  │  │  ├─ app.module.ts      wires modules; applies TenantContextMiddleware (excludes pre-auth routes)
│  │  │  ├─ config/env.schema.ts   fail-fast env validation
│  │  │  ├─ platform/          PG pool (app_user), tenant context (ALS + SET LOCAL), company-access port
│  │  │  ├─ scripts/           migrate.js · load-env.js (zero-dep .env loader) · seed-dev.sql · e2e.sh
│  │  │  ├─ db/migrations/     0001 … 0019 (.up.sql / .down.sql)
│  │  │  └─ modules/           11 bounded contexts (below)
│  │  └─ .env                  LOCAL dev secrets (gitignored)
│  └─ web/          Next.js App Router (48 tsx)
│     ├─ app/                  routes (see §15 below); (app)/ = authenticated shell group
│     ├─ components/ui/        13 shadcn primitives (button, card, dialog, table, …)
│     ├─ components/app/       shell + DS: sidebar, topbar, company-switcher, brand, money(dual), confidence, stat-card, status-badge
│     ├─ lib/api/              client.ts (token + X-Company-Id), endpoints.ts, types.ts, upload.ts
│     ├─ lib/auth/             auth-context.tsx (login/register/oauth/company)
│     └─ lib/                  format.ts (eur/bgn/dates), nav.ts, utils.ts (cn)
├─ infra/          Dockerfile.api/.worker/.web · nginx.conf · docker-validate.sh
├─ docker-compose.yml         db · redis · minio · migrate · api · worker · web
├─ .github/workflows/ci.yml   api · web · docker jobs
├─ 11 architecture .md docs + MASTER + CLAUDE.md + TASK_001..018A + this file
└─ _archive/ (per-task zips, gitignored)   ·   apps/web/out (stale static export — ignore)
```

API modules (11): `identity · tenancy · masterdata · docintel · ledger · tax · invoicing · reporting · audit · notification · health`. Module privacy is ESLint-enforced; reach another module only via its `application/` service token or its `events/`.

## 6. Frontend architecture
- **Next.js App Router**, client-rendered SPA talking to the real API (no mock layer in normal mode; `NEXT_PUBLIC_USE_MOCK` reserved). Dev server on **:3001**, API on **:3000**.
- **Design system (implemented from the "Счетоводство — AI Accounting Design System" handoff):** blue primary `#2F7BE0`, neutral ramp, green/amber/red AA semantics, **Inter** + IBM Plex Mono, tabular money, 8px card radius, elevation shadows — all as CSS-variable tokens in `app/globals.css` consumed by `tailwind.config.ts`. **Light** sidebar + topbar; brand "Счетоводство".
- **Shell:** `app/(app)/layout.tsx` (auth guard + sidebar/topbar/breadcrumbs + mobile drawer). Sidebar groups (Общ преглед / Документи / Счетоводство / Система) — **no "Скоро"; every item links to a real page.**
- **Data:** TanStack Query keyed by company; mutations invalidate. `lib/api/client.ts` injects `Authorization` + `X-Company-Id`, surfaces the backend error envelope, redirects to `/login` on 401.
- **DS components:** `DualMoney` (EUR + ≈ лв.), `ConfidenceBadge`/`ConfidenceMeter` (dot tiers + "Validated ✓" + "Ръчно"), `StatCard` (KPI), `StatusBadge`. Reference: `…-Frontend-Architecture.md`, `…-Design-System.md`, `…-Screen-Specs-Wireframes.md`.

## 7. Backend architecture
- **Modular monolith**; modules talk via in-process application services (by DI token) + domain events. Privileged commit services (post, issue, sign) are role-gated and **unreachable by AI/workers**.
- **Only the ledger posting service writes the ledger** (balanced, immutable, audit in one txn; refuses locked periods; corrections = reversing entries).
- **Validation → compliance gate** before any proposal posts; deterministic validators (EIK/VIES/IBAN/sum) outrank AI.
- **Async/heavy work** → BullMQ worker (scan → OCR/extraction). Idempotent, retries/DLQ.
- Auth: email+password+JWT, RBAC + ABAC guardrails; capability-limited AI identity. Reference: `…-Backend-Architecture.md`, `…-Rules-Engine-Architecture.md`.

## 8. Database architecture
- **PostgreSQL 16**, every tenant table `tenant_id` (+ `company_id`) scoped, **ENABLE + FORCE RLS**, policies `tenant_id = app.current_tenant_id() [AND company_id = app.current_company_id()]`.
- Two roles: **`app_user`** (runtime, `NOBYPASSRLS`, no DELETE on ledger/audit), **`auth_lookup`** (NOLOGIN/BYPASSRLS, owns only the SECURITY DEFINER pre-auth lookup). Migrations run as the **superuser/owner**.
- **Immutable ledger:** `journal_entries`/`journal_lines` append-only (deny-mutation triggers), deferred balance constraint (Σdebit=Σcredit). **Audit:** hash-chained `audit_events` + `verify_audit_chain()`.
- **Migrations 0001–0019** (raw SQL, expand/contract, down-migrations present):
  - 0001 roles · 0002 tenancy core · 0003 RLS · 0004 ledger · 0005 audit · 0006 auth · 0007 masterdata · 0008 documents · 0009 extractions · 0010 rules/suggestions · 0011 review queue · 0012 posting · 0013 vat · 0014 invoicing · 0015 reports
  - **0016 registration** (SECURITY DEFINER `register_account`/`oauth_account` — self-signup creates tenant+user+company)
  - **0017 extraction_fields_extend** (widen `field_key` CHECK: + customer_eik/vat, supplier_city, bank_name/bic, payment_method, vat_rate)
  - **0018 documents_trash** (status `trashed`/`deleted` + `trashed_at`)
  - **0019 review_corrected_fields** (`corrected_fields jsonb` on review_packages — human field edits)

  Reference: `…-Domain-Model-Data-Architecture.md`. ⚠️ **Supabase note:** Supabase's `postgres` role is not a full superuser, so migration 0006's `ALTER ROLE auth_lookup BYPASSRLS` will need adapting when moving the DB to Supabase (see §Priorities).

## 9. Authentication
- **Email/password:** argon2id; `POST /auth/login` → `{accessToken, refreshToken}` (claims `{sub:userId, tid:tenantId}`); refresh rotates + revokes; account lockout (5 fails/15 min); MFA (TOTP) modeled.
- **Registration:** `POST /auth/register {email,password,companyName}` → creates tenant+user(`tenant_admin`)+company(`owner`) and signs in (409 on duplicate). Verified.
- **Google OAuth:** `GET /auth/google` → consent; `GET /auth/google/callback` → exchange code, find/create user by email, issue session, redirect to `${WEB_APP_URL}/auth/callback#access=<token>`. **Config-gated** by `GOOGLE_CLIENT_ID`/`SECRET`; when unset, `/auth/google` redirects back to `/login?error=google_not_configured` (friendly toast, no raw JSON) and `GET /auth/config` returns `{googleEnabled:false}` so the button self-disables.
- **Per-request company context:** `X-Company-Id` header authorized against `company_assignments` (platform `COMPANY_ACCESS_PORT` → tenancy `CompanyAccessAdapter`) in the middleware — **this was the key integration fix** that made company-scoped HTTP endpoints work. Cross-company → 403 (RLS intact).
- **Demo login:** `demo@demo.bg` / `Demo1234!` (seeded; company "Акме Демо ООД", VAT-registered).

## 10. OCR architecture
- Pipeline: **upload → scan(clean) → extraction**, auto-advanced by the **worker** (BullMQ). Status: `pending_upload→uploaded→scanning→ready`.
- Providers (`docintel.module` env-driven): **`DefaultOcrProvider`** = pdfjs text for born-digital PDFs; for image/text-less files it calls `OCR_VENDOR_URL` if set, otherwise a **deterministic dev OCR** that returns a sample Bulgarian invoice so the workflow always completes.
- **Field extractor** (`domain/extraction/field-extractor.ts`): label-driven Bulgarian regex → header fields (supplier name/EIK/VAT/city, customer name/EIK/VAT, invoice no/date/currency, net/VAT/total/rate, IBAN/bank/BIC/payment method). Deterministic validators (EIK checksum, IBAN) set `valid`/`invalid` and outrank confidence.
- **Manual edit/add** (`POST /reviews/:pkg/fields`): human corrections stored on `review_packages.corrected_fields`, overlaid on the immutable extraction (shown as "Ръчно"), and merged into the suggestion/posting.
- Verified on the reference Bulgarian invoice → all 18 header fields correct. Line-item tables are **not** modeled as structured fields (header-field model — documented limitation). Reference: `…-AI-Architecture.md`, `TASK_008`.

## 11. VAT architecture
- Reads the **immutable ledger only**; writes `vat_*` tables. `POST /vat/:y/:m/build` → purchase + sales registers from posted entries; `GET …/summary` → `{outputVat, deductibleVat, vatPayable, vatRefundable}`; `POST …/return` → СД dataset. Deterministic, exact decimals. VAT accounts 4531 (input) / 4532 (output). Reference: `TASK_012`, `…-Rules-Engine-Architecture.md`.

## 12. Invoice architecture
- `POST /invoices` (draft) → `POST /invoices/:id/issue` → **gapless number** (`2026-0001`), PDF (pdf-lib, embedded Cyrillic font), posts **Dr 411 / Cr 702 / Cr 4532**, feeds sales VAT register; issued invoices immutable (DB triggers). Email via Resend/SMTP/dev-log by env. Reference: `TASK_013`.

## 13. Reports architecture
- Reads immutable ledger/invoices/VAT. `GET /reports/{trial-balance,general-ledger,profit-and-loss,balance-sheet,journal,account-card,vat,invoices}`. Trial balance balances (Σdebit=Σcredit); P&L revenue/expense/net; dual-currency in UI. Reference: `TASK_014`.

## 14. Dashboard architecture
- Real backend data: KPI cards (Документи за обработка, Чакащи прегледи, **ДДС за внасяне/възстановяване** [VAT summary], Издадени фактури [invoices], **Нетна печалба** [P&L, green], Статус на отчети) with **dual currency** + an amber VAT-reminder banner. Matches the design-system screenshot. Reference: `TASK_015`.

## 15. Infrastructure architecture
- **Local dev (current):** portable, no-admin under `C:\Users\Cody\pgdev\` — Postgres 16.4 (`pgsql\bin`, data `data`, :5432, trust localhost), Redis 5 (`redis\redis-server.exe` :6379). API/worker run from `dist/` with the `.env` loader. Storage = local disk (`DOC_STORAGE_DIR`).
- **Prod (designed):** AWS eu-central-1 (Frankfurt) — Next on Netlify/Vercel or S3+CloudFront; API+worker on ECS Fargate behind ALB (`/health/ready`); RDS PostgreSQL 16; ElastiCache Redis; S3 + Object-Lock (WORM) + SSE-KMS; secrets in Secrets Manager. `docker-compose.yml` (7 services) + CI present. Reference: `…-Infrastructure-DevOps-Architecture.md`, `DEPLOYMENT.md`, `PREVIEW_RELEASE_v1.md`.

---

## Completed tasks (001–017, + 018A/019 additions)
Status legend: ✅ done & verified · 🟢 enhanced this session.

| # | Purpose | Status | Key files |
|---|---|---|---|
| 001 | Monorepo bootstrap (workspaces, tooling, docs) | ✅ | `package.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml` |
| 002 | Modular-monolith skeleton (10 contexts, ports, ESLint boundaries) | ✅ | `apps/api/src/modules/*`, `shared-kernel/`, `app.module.ts` |
| 003 | Multi-tenancy + PostgreSQL RLS + per-request context | ✅ | migr `0001-0003`, `platform/tenant-context/*`, `platform/database/*` |
| 004 | Immutable ledger + append-only hash-chained audit | ✅ | migr `0004-0005`, `modules/ledger/*`, `modules/audit/*` |
| 005 | Auth: login, MFA(TOTP), RBAC, refresh sessions, JWT resolver | ✅ | migr `0006`, `modules/identity/*` |
| 006 | Master data: companies, counterparties(EIK/VIES), chart of accounts, VAT codes | ✅ | migr `0007`, `modules/masterdata/*` |
| 007 | Document upload (signed-URL → immutable storage) + malware-scan port | ✅ | migr `0008`, `modules/docintel/{document.service,local-object-storage}` |
| 008 | OCR & extraction pipeline (confidence, deterministic validation) | ✅🟢 | migr `0009/0017`, `docintel/{default-ocr-provider,field-extractor,extraction.service}` |
| 009 | Rules engine (account + VAT suggestions, deterministic) | ✅🟢 | migr `0010`, `docintel/rules-engine.service.ts` (balanced-posting fix) |
| 010 | Review queue (human approve/reject/edit; AI cannot decide) | ✅🟢 | migr `0011/0019`, `docintel/review.service.ts`, `reviews.controller.ts` |
| 011 | Posting workflow (approved review → immutable journal entry) | ✅ | migr `0012`, `docintel/posting.service.ts` |
| 012 | VAT module (registers + summary + return from posted entries) | ✅ | migr `0013`, `modules/tax/*` |
| 013 | Invoice issuance (gapless #, PDF, posts ledger + sales VAT) | ✅ | migr `0014`, `modules/invoicing/*` |
| 014 | Financial reports (trial balance, GL, P&L, balance sheet, VAT, invoices) | ✅ | migr `0015`, `modules/reporting/*` |
| 015 | Dashboard & app shell (now real-data + DS) | ✅🟢 | `apps/web/app/(app)/dashboard/page.tsx`, `components/app/*` |
| 016 | Production infra (Docker, health, security hardening, live API wiring) | ✅ | `infra/*`, `docker-compose.yml`, `modules/health/*`, `main.ts` |
| 017 | End-to-end MVP validation (one-command e2e on live services) | ✅ | `apps/api/test/e2e/e2e-workflow.ts`, `scripts/e2e.sh` |
| 018A | Production gap closure (BullMQ worker, S3, real PDF/email, secure cookies) | ✅ | `worker/consumers.ts`, `s3-object-storage.ts`, `pdf-lib-invoice-generator.ts` |
| — (new) | Registration + Google OAuth + dev-storage upload route | ✅ | migr `0016`, `identity/{auth.controller,google-oauth.service}`, `docintel/api/dev-storage.controller.ts` |
| — (new) | Document trash/restore/permanent-delete | ✅ | migr `0018`, `docintel/{document.service,documents.controller}`, `app/(app)/documents/page.tsx` |
| — (new) | Design system applied (tokens, light shell, brand, dual money, confidence) | ✅ | `app/globals.css`, `tailwind.config.ts`, `components/app/{sidebar,topbar,brand,money,confidence,stat-card}` |

---

## Current repository state
- **Branch:** `main` · **Remote:** `origin` = `https://github.com/Extraterrestri0/ai-accounting-platform.git`
- **Commits (2):** `3d6b149` initial canonical monorepo · `0024f9b` (HEAD) add GitHub push & deployment guide.
- ⚠️ **Working tree is NOT committed.** Everything since the assembly — the live backend bring-up, the connected frontend, all 11+ screens, registration/OAuth, trash, manual-edit, and the design system — exists **only in the working tree** (uncommitted). **First action for a new session: review the diff and commit** (`feat`: live app + design system), then push. Safety-critical paths (ledger/RLS/tax) want human review per CODEOWNERS.

### Working features (verified on the live stack)
Register · Login · Logout · Session persistence · Protected routes · Company switch (+create) · **Upload → scan → OCR/extraction** (born-digital + deterministic dev OCR; Bulgarian fields correct) · **Manual edit/add fields** (flows to posting) · Generate suggestion · Create review · Approve/Reject · **Post to ledger** (balanced) · Build VAT registers + summary · Create + **Issue invoice** (gapless #, PDF, posts) · Reports (trial balance balanced, P&L, GL) · Dashboard real KPIs · **Document trash/restore/permanent-delete** · Design-system UI (blue/Inter/light shell, dual currency, confidence dots).

### Broken / not-yet-done features
- **Google login** — code complete but **needs your `GOOGLE_CLIENT_ID`/`SECRET`** (config, not a bug). Friendly fallback until then.
- **Real OCR vendor** for scanned/arbitrary images — adapter wired (`OCR_VENDOR_URL`/`KEY`); **no vendor configured** → images use the deterministic dev sample.
- **Supabase** — not yet provisioned (you're creating the EU project; I wire it; migration 0006 BYPASSRLS needs adapting).
- **AI chat panel** (in the design) — intentionally **not built** (out of MVP scope per `CLAUDE.md` §15).
- **Working tree uncommitted** (see above).
- Minor: invoice **inline PDF viewer** not built (status/ledger/VAT impact shown); line-item extraction not structured; some DS reference screens (VAT-return stepper + КЕП commit modal) not yet ported.

### Routes (all return 200 — no 404, no placeholders)
`/` `/login` `/register` `/auth/callback` · `/dashboard` `/documents` `/documents/upload` `/documents/ocr` `/upload` `/review` `/review/[id]` `/suggestions` `/queue` `/posting` `/vat` `/invoices` `/reports` `/settings` `/profile`. (`/documents/ocr`, `/documents/upload`, `/suggestions`, `/queue`, `/profile` are redirect routes into the canonical pages.)

---

## Known issues — actual status (the items you listed)
| Item | Status |
|---|---|
| **Google OAuth** showing raw JSON | ✅ **FIXED** — `/auth/google` now redirects to `/login?error=…` (friendly toast); button self-disables via `/auth/config`. Needs your client id/secret to fully enable. |
| **OCR extraction** incomplete | ✅ **WORKS** — born-digital + deterministic dev OCR; reference Bulgarian invoice extracts all 18 header fields; manual edit covers gaps. Real-vendor for scans is a config add. |
| **Settings crash** (`cpQ.data.map is not a function`) | ✅ **FIXED** — `/counterparties` is paginated; endpoint normalized to an array. |
| **Sidebar placeholders ("Скоро")** | ✅ **REMOVED** — all 9 nav items link to real pages. |
| **Route issues / missing routes** | ✅ **FIXED** — all routes 200; redirects added for the verification paths. |

---

## Current priorities (recommended order)
1. **Commit the working tree** (it's the whole product) → push → tag a baseline.
2. **Product stabilization** — run the full loop once more on a clean restart; confirm no regressions after the design-system pass.
3. **Supabase** — when you send the EU connection string: adapt migration 0006 (BYPASSRLS) to Supabase's role model, run `0001–0019` + `seed-dev.sql`, point `apps/api/.env` `PG*` at it, restart.
4. **Google login** — paste `GOOGLE_CLIENT_ID`/`SECRET` into `apps/api/.env`, restart API.
5. **OCR improvements** — wire the chosen EU OCR vendor (`OCR_VENDOR_URL`/`KEY`); contract: `POST` file bytes → `{ text, pageCount }`.
6. **UX polish** — port remaining DS reference screens (VAT-return stepper + КЕП commit modal from `_di_extract/part5`), invoice PDF viewer, fresh screenshots.

---

## Exact startup commands (local)
Portable Postgres + Redis live under `C:\Users\Cody\pgdev\`. Four processes.
```powershell
# 1) Postgres (if stopped)
C:\Users\Cody\pgdev\pgsql\bin\pg_ctl.exe -D C:\Users\Cody\pgdev\data -l C:\Users\Cody\pgdev\pg.log -o "-p 5432" -w start
# 2) Redis (if stopped)
Start-Process C:\Users\Cody\pgdev\redis\redis-server.exe -ArgumentList '--port 6379 --appendonly no' -WindowStyle Hidden
# 3) API + Worker  (from apps/api)
cd C:\Users\Cody\Desktop\MGI-Delta\apps\api
npm run build                                   # if code changed
node -r ./scripts/load-env.js scripts/migrate.js   # if new migrations  (set $env:MIGRATION_USER='postgres';$env:MIGRATION_PASSWORD='postgres' first)
node -r ./scripts/load-env.js dist/main.js      # API → http://localhost:3000
node -r ./scripts/load-env.js dist/worker.js    # WORKER (REQUIRED for upload→OCR)
# 4) Web  (from repo root)
cd C:\Users\Cody\Desktop\MGI-Delta
npm run dev --workspace apps/web                # → http://localhost:3001
```
First DB setup (once): `createdb accounting` as superuser `postgres`, run `migrate.js`, then `psql -U postgres -d accounting -f apps/api/scripts/seed-dev.sql`.
**Demo login:** `demo@demo.bg` / `Demo1234!`. **Open:** http://localhost:3001
> Gotcha: don't run `npm run build` in `apps/web` while the dev server is up — it corrupts `.next` (`Cannot find module './vendor-chunks/next.js'`). Fix: stop dev, `Remove-Item -Recurse -Force apps/web/.next`, restart.

### Verification gates (all green)
- `npm test --workspace apps/api` → **60/60** (11 suites) · `npm run lint` (api+web) → clean · `tsc --noEmit` (api+web) → **0** · `npm run build --workspace apps/web` → **21 routes**.
- Backend env vars: `apps/api/.env` (gitignored). Google + OCR vendor keys go there. `.env.example` documents all vars.

---

## Repository tree (top level)
```
MGI-Delta/
├─ apps/api/        (NestJS · 255 .ts · migrations 0001-0019 · scripts · test)
├─ apps/web/        (Next.js · 48 tsx · 13 ui + 13 app components · lib)
├─ infra/           (Dockerfiles · nginx.conf · docker-validate.sh)
├─ .github/workflows/ci.yml
├─ docker-compose.yml · .env.example · .gitignore · package.json · package-lock.json
├─ CLAUDE.md  AI_ACCOUNTING_PLATFORM_MASTER_v1.md
├─ AI-Accounting-Platform-*.md   (11 architecture docs: Architecture, UX, Design-System,
│                                  Screen-Specs, Domain-Model-Data, Rules-Engine, AI,
│                                  Backend, Frontend, Infrastructure-DevOps, MVP-Roadmap)
├─ TASK_001..TASK_018A.md  PROJECT_STATUS.md  PREVIEW_RELEASE_v1.md  REPOSITORY_READINESS_REPORT.md
├─ GITHUB_PUSH_GUIDE.md  DEPLOYMENT.md  README.md  CONTRIBUTING.md  LICENSE
└─ PROJECT_HANDOFF_v1.md   (this file)
```

---
*Handoff complete. A new agent should: read `CLAUDE.md` + this file → start the stack (commands above) → commit the working tree → continue from §Priorities. Obey the 10 invariants and the §15 NEVERs; cite the architecture docs instead of re-deriving.*
