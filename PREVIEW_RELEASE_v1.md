# PREVIEW_RELEASE_v1 — Deployment Guide

AI Accounting Platform (Bulgarian-first, EUR-native) — MVP preview release. Backend: NestJS modular monolith + PostgreSQL (RLS) + Redis + object storage. Frontend: Next.js (App Router, static export). This guide is everything needed to start, verify, and deploy the release.

**Build verification (run for this release):**
- ✅ Backend build — `tsc --noEmit` clean; `tsc -p tsconfig.build.json` emits `dist/main.js` + `dist/worker.js`.
- ✅ Frontend build — `next build` succeeds; 14 routes prerendered as static content (`out/`).
- ✅ Docker compose — definition validates (7 services: db, redis, minio, migrate, api, worker, web).
- ✅ Tests — backend jest 60/60 (11 suites); E2E workflow 14/14 on real services + live PostgreSQL.

---

## 1. Repository structure review

```
repo/
├─ apps/
│  ├─ api/                         # NestJS modular monolith (backend)
│  │  ├─ src/
│  │  │  ├─ main.ts                # HTTP bootstrap: helmet, CORS, cookies, validation, shutdown
│  │  │  ├─ worker.ts              # queue-worker entrypoint (no HTTP port)
│  │  │  ├─ app.module.ts          # wires all modules + ThrottlerGuard (rate limit)
│  │  │  ├─ config/env.schema.ts   # env validation (fail-fast)
│  │  │  ├─ platform/              # PG pool (app_user), tenant context, scoped client (RLS)
│  │  │  └─ modules/               # bounded contexts (public surface only)
│  │  │     identity · tenancy · masterdata · docintel · ledger ·
│  │  │     tax · invoicing · reporting · audit · notification · health
│  │  ├─ db/migrations/            # 0001 … 0015 (.up.sql / .down.sql)
│  │  ├─ scripts/                  # migrate.js · seed-e2e.sql · e2e.sh (one-command validator)
│  │  ├─ test/                     # 11 jest suites + test/e2e/e2e-workflow.ts
│  │  ├─ package.json              # build / start / migrate / test scripts
│  │  └─ tsconfig*.json
│  └─ web/                         # Next.js App Router (frontend, static export)
│     ├─ app/                      # routes: / /accountant /company + 8 module screens
│     ├─ components/shell/         # AppShell · Sidebar (role-aware) · TopBar (company/role switch)
│     ├─ components/dashboard/     # Main · Accountant · Company dashboards + widgets
│     ├─ components/domain/        # the 8 MVP screens (documents…reports)
│     ├─ lib/                      # api-layer (real⇄mock) · money (EUR/BGN) · i18n (BG) · mock-api
│     ├─ next.config.mjs           # output: 'export'
│     └─ package.json
├─ infra/
│  ├─ Dockerfile.api · Dockerfile.worker · Dockerfile.web · nginx.conf
│  └─ docker-validate.sh
├─ docker-compose.yml              # db · redis · minio · migrate · api · worker · web
├─ .env.example                    # secret/config template (copy to .env, never commit)
└─ DEPLOYMENT.md                   # ops detail (diagram, backup/restore, monitoring)
```

**Design guarantees baked in (verified end-to-end in Task 017):** tenant isolation via Postgres RLS; immutable hash-chained ledger + audit; AI proposes but cannot post or approve (DB-enforced); deterministic validators outrank AI; EUR functional currency with exact decimals + BGN dual display.

---

## 2. Startup instructions (local, no Docker)

Prerequisites: Node 20+, a PostgreSQL 16 reachable locally, (optional) Redis + an S3-compatible store.

```bash
# --- Backend (apps/api) ---
cd apps/api
npm install
export $(grep -v '^#' ../../.env | xargs)      # or set env vars manually (see §6)
npm run build                                    # tsc → dist/
npm run migrate                                  # applies db/migrations/*.up.sql (as the owner role)
npm start                                        # node dist/main.js  → http://localhost:3000
#   health: curl http://localhost:3000/health/ready

# --- Frontend (apps/web), in a second terminal ---
cd apps/web
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 PORT=3001 npm run dev   # → http://localhost:3001
#   or production static: NEXT_PUBLIC_API_URL=http://localhost:3000 npm run build && npx serve out
```

> Port note: the API defaults to 3000 and Next dev also defaults to 3000 — run the web on a different port (`PORT=3001`) and point `NEXT_PUBLIC_API_URL` at the API. With no `NEXT_PUBLIC_API_URL`, the frontend runs on its bundled mock-data layer (no backend needed).

**One-command full validation:** `cd apps/api && ./scripts/e2e.sh` (add `USE_DOCKER=1` to spin up Postgres via compose). It builds, migrates, seeds deterministic demo data, runs the jest suite, and runs the end-to-end workflow against real services.

---

## 3. Exact Netlify deployment steps (frontend)

1. Push the repo to Git; in Netlify, **Add new site → Import an existing project**, pick the repo.
2. **Site configuration → Build & deploy → Build settings:**
   - Base directory: `apps/web`
   - Build command: `next build`
   - Publish directory: `apps/web/out`
3. **Environment variables** (Site configuration → Environment variables):
   - `NEXT_PUBLIC_API_URL` = `https://api.<your-domain>`
   - `NEXT_PUBLIC_USE_MOCK` = `false`
4. **Deploy site.** Netlify builds the static export and serves `out/`.
5. On the **backend**, set `CORS_ORIGINS` to the Netlify URL (e.g. `https://<site>.netlify.app`) so the browser may call it with credentials.
6. Verify: open the site → the dashboard loads and network calls hit `https://api.<your-domain>/...`.

*(Static export needs no serverless functions. If you prefer the Next runtime, add `@netlify/plugin-nextjs` and drop the publish dir.)*

---

## 4. Exact Vercel deployment steps (frontend)

1. In Vercel, **Add New → Project**, import the repo.
2. **Configure Project:**
   - Root Directory: `apps/web`
   - Framework Preset: **Next.js** (auto-detected; build & output inferred)
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://api.<your-domain>`
   - `NEXT_PUBLIC_USE_MOCK` = `false`
4. **Deploy.**
5. Set the backend `CORS_ORIGINS` to the Vercel URL (`https://<project>.vercel.app`).
6. Verify the deployed app calls the real API.

---

## 5. Exact local Docker startup steps (full stack)

Prerequisites: Docker + Docker Compose.

```bash
cp .env.example .env          # then edit .env — fill REAL values (see §6)
                              #   PGUSER must be app_user (RLS subject), NOT the owner
docker compose up --build     # builds api/worker/web; starts db, redis, minio, migrate(one-shot), api, worker, web
```
Service URLs:
- Frontend → **http://localhost:8080**
- API → **http://localhost:3000**  (health: `http://localhost:3000/health/ready`)
- MinIO console → http://localhost:9001

Startup order is enforced: `db`/`redis`/`minio` become healthy → `migrate` runs to completion → `api`/`worker` start → `web`. The API refuses to start unless env validation + DB connectivity pass (fail-fast).

Validate the stack definition without starting it: `bash infra/docker-validate.sh` (runs `docker compose config` + image build when Docker is present).

Tear down: `docker compose down` (add `-v` to drop the db/redis/minio volumes).

---

## 6. Required environment variables

Copy `.env.example` → `.env` (gitignored). **Secrets live only here / in a secrets manager — never in the repo.**

| Variable | Used by | Example / note |
|---|---|---|
| `NODE_ENV` | api | `production` |
| `PORT` | api | `3000` |
| `PGHOST` / `PGPORT` | api, worker | `db` / `5432` |
| `PGDATABASE` | api, worker, migrate | `accounting` |
| `PGUSER` / `PGPASSWORD` | api, worker | **`app_user`** — RLS subject, never the owner/BYPASSRLS |
| `POSTGRES_SUPERUSER` / `POSTGRES_SUPERUSER_PASSWORD` | db, migrate | owner role used only for migrations |
| `JWT_SECRET` | api | ≥ 32 random chars (rejected at startup if weak in production) |
| `REDIS_URL` | api, worker | `redis://redis:6379` |
| `STORAGE_ENDPOINT` | api, worker | `http://minio:9000` (prod: AWS S3) |
| `STORAGE_BUCKET` / `STORAGE_REGION` | api, worker | `documents` / `eu-central-1` |
| `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | api, worker, minio | object-storage credentials |
| `CORS_ORIGINS` | api | comma-separated allow-list, e.g. the Netlify/Vercel URL |
| `RATE_LIMIT_TTL` / `RATE_LIMIT_MAX` | api | `60000` / `300` |
| `NEXT_PUBLIC_API_URL` | web (build-time) | `https://api.<domain>` — omit to use the mock preview |
| `NEXT_PUBLIC_USE_MOCK` | web (build-time) | `false` |

---

## 7. Production readiness checklist

**Ready now (verified):**
- [x] Backend builds to runnable JS; frontend builds to static export; compose validates.
- [x] Health/readiness/liveness endpoints + fail-fast startup validation (env + DB).
- [x] Security headers (helmet), CORS allow-list with credentials, rate limiting, cookie parsing.
- [x] Secrets via env only; weak/placeholder secrets rejected in production; `.env` gitignored.
- [x] DB least privilege: runtime connects as `app_user` (RLS), migrations as a separate owner.
- [x] Immutable ledger + hash-chained audit; RLS tenant isolation; AI cannot post/approve — all proven E2E.
- [x] One-command local validation (`scripts/e2e.sh`) + deterministic seed.

**Before a real pilot (recommended, tracked for Task 018):**
- [ ] Run `docker compose up` + image builds on a Docker host (not exercised in the build sandbox).
- [ ] Live object-storage check (S3/MinIO `headBucket` probe) and WORM/Object-Lock bucket in the EU region.
- [ ] Worker binds the BullMQ consumers (OCR/extraction/malware-scan) against Redis in production.
- [ ] Browser E2E (Playwright) against the live stack over HTTP.
- [ ] Auth cookie hardening (Secure/HttpOnly/SameSite, refresh rotation) + TLS termination.
- [ ] Backups: RDS automated snapshots + PITR (or `pg_dump` to an EU bucket); test a restore; verify `app.verify_audit_chain` post-restore.
- [ ] Observability: ship structured logs to an aggregator; alerts on `/health/ready`, DB/Redis, queue backlog, 5xx/429.
- [ ] Confirm production data is never copied unmasked to lower environments.

---

## Final deployment recommendation

- **Fastest preview:** deploy `apps/web` to Netlify or Vercel with `NEXT_PUBLIC_USE_MOCK=true` — a fully navigable, backend-free demo of the whole MVP UI.
- **Full system, local:** `docker compose up --build` (frontend `:8080`, API `:3000`).
- **Production (EU residency):** frontend on Netlify/Vercel (or S3+CloudFront); API + worker as containers on AWS ECS Fargate (Frankfurt) behind an ALB health-checking `/health/ready`; RDS PostgreSQL 16; ElastiCache Redis; S3 with Object Lock; secrets in AWS Secrets Manager. Point `NEXT_PUBLIC_API_URL` at the API and the API's `CORS_ORIGINS` at the frontend. Full ops detail in `DEPLOYMENT.md`.

*Release: PREVIEW_RELEASE_v1 · backend build ✅ · frontend build ✅ · docker compose ✅ · 60/60 unit + 14/14 E2E.*
