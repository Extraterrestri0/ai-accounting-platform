# TASK 015 — Dashboard & App Preview

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 015 · **Depends on:** 002–014 (frontend screens) · **PR:** one scoped PR (frontend only).
**Deliverable:** `task015-dashboard-preview.zip` → a self-contained `apps/web` Next.js app (source only; `node_modules`/`.next`/`out` excluded).

> **Verified during build:** `npm run typecheck` clean · `npm run lint` (next/core-web-vitals) **zero warnings/errors** · `npm run build` **succeeds** — all 14 routes prerendered as static content (`○ Static`). The app is a faithful **Next.js App Router static export** (the chosen frontend stack), runnable locally and deployable to Netlify/Vercel, with a mock-data layer so it needs no backend.

## 1. Files created
- **Scaffold:** `package.json` (next 14.2.33, react 18.3.1, @tanstack/react-query 5; dev: typescript, tailwind, postcss, autoprefixer, eslint + eslint-config-next), `next.config.mjs` (`output:'export'`), `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `.eslintrc.json`, `README.md`.
- **lib/:** `money.ts` (EUR functional, `dual()` EUR + BGN at fixed 1 € = 1.95583 лв.), `i18n.ts` (Bulgarian-first labels), `mock-api.ts` (intercepts `/api/*` with internally-consistent canned data).
- **components/shell/:** `AppContext.tsx` (role owner/accountant/approver/viewer + company switcher, 2 mock companies), `Sidebar.tsx` (role-aware, BG/EN nav grouped Общи/Документи/Счетоводство), `TopBar.tsx` (company + role switchers + EUR rate), `AppShell.tsx`.
- **components/dashboard/:** `MainDashboard.tsx` (6 widgets), `AccountantDashboard.tsx`, `CompanyDashboard.tsx`, `widgets.tsx`.
- **app/:** `layout.tsx` (`lang="bg"`, AppShell), `providers.tsx` (mock API + React Query + App context), `globals.css`, and 11 route `page.tsx` files (`/`, `/accountant`, `/company`, `/documents`, `/extraction`, `/suggestions`, `/review`, `/posting`, `/vat`, `/invoices`, `/reports`).

## 2. Files modified
- **Connected existing representative screens** (gathered, unchanged, from Tasks 007–014 — verified byte-identical to each task's canonical output): documents (Upload/Archive/Preview), OCR extraction, suggestions, review (Queue/Detail/Reviewer dashboard), posting, VAT (Dashboard/Register/Summary), invoicing (List/Create/Detail/Preview), reporting (Dashboard/Trial Balance/General Ledger/P&L/VAT Report).
- One targeted `eslint-disable-next-line @next/next/no-img-element` in the documents `FilePreviewScreen` (intentional `<img>` in a static-export preview) — no behavior change.

## 3. UI screenshots
Rendered inline above: the **Main Dashboard** inside the full app shell — Bulgarian-first sidebar (role-aware, grouped Общи / Документи / Счетоводство), top bar with the company switcher (Акме ООД) + role switcher (Счетоводител) + EUR/BGN rate, and the six widgets: documents pending (7), reviews pending (3), invoices issued (12), **VAT payable 20.00 € / 39.12 лв.**, reports status (Готови ✓), net profit 200.00 €, plus a recent-activity feed. The same numbers used throughout the MVP carry through (invoice 2026-0001, VAT payable 20.00, net profit 200.00).

## 4. Local preview instructions
```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000
# or: npm run build && npx serve out   (static export in ./out)
```
Switch role/company from the top bar; navigate every screen from the sidebar. Scripts: `npm run typecheck`, `npm run lint`, `npm run build`.

## 5. Netlify / Vercel preview instructions
- **Netlify** — base `apps/web`, build `next build`, publish `apps/web/out` (static export; `@netlify/plugin-nextjs` also works).
- **Vercel** — import repo, set Root Directory = `apps/web`, framework **Next.js** (auto). No env vars (mock-data layer).

## 6. Known limitations
- **Mock-data layer, not the live backend** — `lib/mock-api.ts` intercepts `/api/*` so the preview runs standalone. Wiring the real NestJS API later means removing `installMockApi()` in `app/providers.tsx`; the screens are unchanged.
- **Representative screens** — the gathered domain screens are illustrative (built per task, not all individually type-checked in the API harness); here they compile and build as part of a real Next app.
- **Build-time ESLint is set to not block** in `next.config.mjs` (`eslint.ignoreDuringBuilds:true`), but lint is run explicitly as a gate (`npm run lint`, zero warnings) and the type gate (`tsc --noEmit`) is clean.
- **Demo fixed IDs** — detail routes use fixed demo ids (e.g. `doc-1`, `inv-1`) to keep the static export free of dynamic `generateStaticParams`.
- **PDF / email / file previews are placeholders** (consistent with the backend dev adapters from Tasks 007/013).

## 7. Next recommended task
**Task 016 — Production Infrastructure** (AWS EU/Frankfurt, secrets management, CI/CD, real object storage with Object Lock/WORM, the worker queue, and connecting this web app to the live API). After that: **017 — E2E MVP Validation** and **018 — Pilot Readiness**.

---
**Acceptance met:** a user can `npm install && npm run dev` in `apps/web` and navigate the full MVP — dashboards plus all eight context screens — with Bulgarian-first UI, EUR/BGN display, role-aware navigation, and a company switcher. Verified: typecheck clean, lint zero-warnings, production build succeeds (14 static routes).
*Commit: `feat(web): MVP dashboard & runnable Next.js preview — app shell, role-aware nav, company switcher, dashboards (BG-first, EUR/BGN)`.*
