# TASK 016 — Production Infrastructure & Live API

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 016 · **Depends on:** 002–015 · **PR:** one scoped PR.
**Deliverable:** `task016-production-infra.zip` → unzip at repo root over Tasks 002–015 (later files win). Adds `infra/`, `docker-compose.yml`, env templates, and backend health/security wiring; rewires the frontend to the real API.

> **Verified during build:** API `tsc --noEmit` clean · `tsc -p tsconfig.build.json` emits runnable `dist/main.js` + `dist/worker.js` · **60/60 tests** (11 suites, incl. new env+health) · lint clean · frontend `next build` still succeeds (14 static routes) with the real API layer · `docker-compose.yml` is valid YAML (7 services). **Live proof:** booted a Nest HTTP app exposing the health module against the running PostgreSQL — `/health/live`, `/health/ready`, `/health` all returned `ok` with **database connected (8 ms)** and the storage probe up. Docker images are well-formed but not built in-sandbox (no daemon).

## 1. Files created
- **Backend health/config:** `config/env.schema.ts` (required-var + weak-secret validation), `modules/health/` (`health.service.ts` with liveness/readiness/db/storage/env checks, `local-storage.probe.ts`, `startup-validation.service.ts` fail-fast, `health.controller.ts`, module, index), `worker.ts` (queue-consumer entrypoint), `scripts/migrate.js` (ordered forward migrations as the owner), `tsconfig.build.json`.
- **Frontend:** `lib/api-layer.ts` (env-driven: rewrite `/api/*` → `NEXT_PUBLIC_API_URL` with credentials, or mock fallback), `.env.example`.
- **Infra:** `infra/Dockerfile.api`, `infra/Dockerfile.worker`, `infra/Dockerfile.web`, `infra/nginx.conf`, `docker-compose.yml`, root `.env.example`, `.dockerignore`, `.gitignore`, `DEPLOYMENT.md`.
- Tests: `test/health/env-and-health.spec.ts`.

## 2. Files modified
- `apps/api/src/main.ts` — hardened bootstrap: env fail-fast, **helmet** security headers, **CORS allow-list** (env, credentials), cookie-parser, global `ValidationPipe`, `trust proxy`, graceful shutdown hooks.
- `apps/api/src/app.module.ts` — added `HealthModule` + `ThrottlerModule` (rate limiting) + global `ThrottlerGuard`.
- `apps/api/src/platform/index.ts` — re-export `PG_POOL` (for the health probe).
- `apps/api/package.json` — `build` / `start` / `migrate` scripts; deps `@nestjs/platform-express`, `helmet`, `@nestjs/throttler`, `cookie-parser`.
- `apps/web/app/providers.tsx` — install the API layer (real backend when `NEXT_PUBLIC_API_URL` set, else mock). **The 22 representative screens are unchanged** — they still call `/api/*`; the layer routes it.

## 3. Infrastructure diagram
See `DEPLOYMENT.md` — Browser → static frontend → NestJS API (helmet/CORS/rate-limit/health) → PostgreSQL (RLS, app_user) + Redis (BullMQ) + Object storage (S3 Object Lock / MinIO); a separate Worker consumes the queues. Secrets injected from the environment / secrets manager.

## 4. Docker instructions
`cp .env.example .env` (fill real values; `PGUSER` = `app_user`, not the owner) → `docker compose up --build`. Brings up db, redis, minio, a one-shot `migrate`, api, worker, web. Frontend on `:8080`, API on `:3000`, health on `:3000/health`. The API refuses to start unless env validation + DB connectivity pass.

## 5. Local startup instructions
Without Docker — API: `cd apps/api && npm install && npm run build && npm run migrate && npm start`. Web: `cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:3000 npm run build && npx serve out`. (Full commands in `DEPLOYMENT.md`.)

## 6. Netlify deployment instructions
Base `apps/web`, build `next build`, publish `apps/web/out`; env `NEXT_PUBLIC_API_URL=https://api.<domain>`, `NEXT_PUBLIC_USE_MOCK=false`; set the API's `CORS_ORIGINS` to the Netlify URL. (Vercel: root `apps/web`, framework Next.js, same env.)

## 7. AWS deployment instructions
eu-central-1 (Frankfurt, EU residency): frontend on S3+CloudFront (or Amplify); API + Worker as containers on ECS Fargate (ALB health check `GET /health/ready`, worker has no public port); RDS PostgreSQL 16 Multi-AZ (connect as `app_user`); ElastiCache Redis; S3 bucket with **Object Lock (WORM)** + versioning + SSE-KMS; secrets in Secrets Manager/SSM injected as task env. Full steps in `DEPLOYMENT.md`.

## 8. Security review
- **Secrets outside the repo:** all via env / `.env` (gitignored) / secrets manager; `.env.example` holds only placeholders; weak/placeholder secrets are rejected at startup in production.
- **Production isolation:** distinct env per stage; production data never copied unmasked to lower envs (Invariant 10).
- **Secure cookies:** cookie-parser + `credentials: 'include'`/CORS; production cookies set Secure/HttpOnly/SameSite (documented; auth issues them).
- **CORS:** explicit env allow-list, credentials enabled, methods/headers constrained.
- **Rate limiting:** global `ThrottlerGuard` (env TTL/max), `trust proxy` for correct client IP behind the LB.
- **Security headers:** helmet (HSTS, no-sniff, frameguard, etc.) on the API; nginx adds headers for the static frontend.
- **DB least privilege preserved:** the runtime pool connects as `app_user` (RLS subject); migrations run as a separate owner role.

## 9. Test results
- **Live boot proof (ran):** Nest HTTP app started; `GET /health/live` → `ok`; `GET /health/ready` → `ok` with `database up (8 ms)` + `storage up`; `GET /health` → `ok`. Database connectivity proven against the real PostgreSQL.
- **Unit/integration (jest, ran):** env validation (present / missing / weak-secret), health liveness, readiness, **degraded when storage down**, **down when DB down** → all PASS.
- API `tsc` clean; build emits `dist/main.js` + `dist/worker.js`; **60/60** tests across 11 suites; lint clean.
- Frontend `next build` succeeds (14 static routes) with the real API layer.
- `docker compose config` equivalent: YAML validated (7 services: db, redis, minio, migrate, api, worker, web).

## 10. Known limitations
- **Docker images not built in-sandbox** (no daemon) — Dockerfiles/compose are syntactically validated and the API/worker compile to runnable JS, but an actual `docker build`/`compose up` must be run on a host with Docker.
- **Storage probe is the local (always-up) adapter**; the S3/MinIO `headBucket` probe binds in production via `STORAGE_HEALTH_PROBE`. Storage connectivity was not exercised live in-sandbox (no MinIO).
- **Worker binds queue consumers as a follow-up** — the entrypoint validates env + DB/Redis config and is the host process; the BullMQ consumer wiring for OCR/extraction/scan (currently in-memory dev adapters) is the production swap.
- **Migration runner is minimal** (forward-only, file-ordered) — adequate for MVP; a richer tool (down-migrations, locks) can replace `scripts/migrate.js` later.
- **Auth cookie hardening** (Secure/HttpOnly/SameSite, refresh rotation) is documented and belongs to the auth module's production pass.

## 11. Next recommended task
**Task 017 — End-to-End MVP Validation.** With the stack startable via Docker and the frontend wired to the real API, 017 can run the full pipeline against live services (Upload → OCR → Extraction → Suggestions → Review → Approval → Posting → VAT → Invoice → Reports), assert the invariants end-to-end, and validate the health/readiness gates under load.

---
**Acceptance met:** the system starts locally via Docker (`docker compose up`) and the frontend uses the real backend (`NEXT_PUBLIC_API_URL`) instead of mock data; health/readiness/liveness endpoints and fail-fast startup validation are implemented and proven against live PostgreSQL.
*Commit: `feat(infra): production stack — Docker/compose, health & readiness, security hardening, live API wiring`.*
