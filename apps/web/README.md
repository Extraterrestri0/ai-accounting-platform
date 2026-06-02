# AI Accounting Platform — Web Preview (MVP)

A runnable **Next.js (App Router) static-export** preview that wires the MVP screens into a usable app:
Bulgarian-first UI, EUR/BGN dual display, role-aware navigation, a company switcher, and dashboard widgets.
It ships with a **mock-data layer** (`lib/mock-api.ts`) that intercepts `/api/*`, so it runs with **no backend**.

## Run locally
```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000  (hot reload)
```
Or build the static site and serve it:
```bash
npm run build        # outputs ./out (static export)
npx serve out        # or any static file server
```
Verification scripts: `npm run typecheck`, `npm run lint`, `npm run build`.

## Navigate the MVP
Dashboards: `/` (Main), `/accountant`, `/company`. Screens: `/documents`, `/extraction`, `/suggestions`,
`/review`, `/posting`, `/vat`, `/invoices`, `/reports`. Use the top bar to switch **role** (owner / accountant /
approver / viewer — the sidebar adapts) and **company** (Акме ООД / Бета ЕООД).

## Deploy a preview

### Netlify
- Base directory: `apps/web`
- Build command: `next build`
- Publish directory: `apps/web/out`
- (Static export — no server functions needed. The `@netlify/plugin-nextjs` plugin also works if you prefer.)

### Vercel
- Import the repo; set **Root Directory** = `apps/web`.
- Framework preset: **Next.js** (auto-detected). Build/output are inferred.
- No env vars required — the preview uses the mock-data layer.

## What's mocked
`lib/mock-api.ts` returns canned, internally consistent data (the same numbers used throughout the MVP:
VAT payable 20.00 €, net profit 200.00 €, invoice 2026-0001). Swapping in the real API later means deleting the
`installMockApi()` call in `app/providers.tsx` and pointing fetches at the NestJS backend — the screens are unchanged.
