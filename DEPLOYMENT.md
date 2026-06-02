# Deployment & Operations

## Infrastructure diagram
```
                        ┌──────────────────────────────────────────────┐
   Browser ── HTTPS ──▶ │  Frontend (Next.js static export)             │
                        │  Netlify / Vercel / S3+CloudFront / nginx      │
                        └───────────────┬────────────────────────────────┘
                            fetch /api/* │  (NEXT_PUBLIC_API_URL, credentials: include)
                                         ▼
                        ┌──────────────────────────────────────────────┐
                        │  API (NestJS)  — helmet, CORS allow-list,      │
                        │  rate limit, secure cookies, /health probes    │
                        └───┬───────────────┬───────────────┬────────────┘
                            │ pg (app_user) │ BullMQ        │ S3 SDK
                            ▼               ▼               ▼
                   ┌──────────────┐  ┌────────────┐  ┌────────────────────┐
                   │ PostgreSQL16 │  │  Redis     │  │ Object storage      │
                   │ RLS + WORM   │  │  (queues)  │  │ S3 (Object Lock) /  │
                   │ ledger/audit │  │            │  │ MinIO (local)       │
                   └──────────────┘  └─────┬──────┘  └────────────────────┘
                                           │ consume
                                           ▼
                                   ┌────────────────┐
                                   │ Worker (BullMQ)│  OCR / extraction / malware-scan
                                   └────────────────┘
```
Secrets are injected from the environment / a secrets manager — never baked into images or the repo.

## Local (Docker)
```bash
cp .env.example .env        # fill real values (PGUSER must be app_user, not the owner)
docker compose up --build   # db, redis, minio, migrate (one-shot), api, worker, web
# Frontend  → http://localhost:8080   API → http://localhost:3000   API health → :3000/health
```
`migrate` runs `scripts/migrate.js` (applies db/migrations/*.up.sql as the owner) before the API starts.
The API will not start unless env validation + DB connectivity pass (fail-fast).

## Local (without Docker)
- API: `cd apps/api && npm install && npm run build && npm run migrate && npm start` (set env first).
- Web: `cd apps/web && npm install && NEXT_PUBLIC_API_URL=http://localhost:3000 npm run build && npx serve out`.

## Netlify (frontend)
- Base `apps/web`, build `next build`, publish `apps/web/out`.
- Env: `NEXT_PUBLIC_API_URL=https://api.<your-domain>`, `NEXT_PUBLIC_USE_MOCK=false`.
- Point the API's `CORS_ORIGINS` at the Netlify URL.

## Vercel (frontend)
- Root `apps/web`, framework Next.js (auto). Same env vars as Netlify.

## AWS (full stack, eu-central-1 / Frankfurt — EU residency)
- **Frontend**: S3 (static `out/`) + CloudFront, or Amplify Hosting.
- **API + Worker**: container images (the two Dockerfiles) on ECS Fargate (or EKS); ALB in front of the API,
  target group health check `GET /health/ready`. Worker is a separate service (no public port).
- **PostgreSQL**: RDS for PostgreSQL 16 (Multi-AZ), in private subnets; the app connects as `app_user`.
- **Redis**: ElastiCache for Redis.
- **Object storage**: S3 bucket with **Object Lock (WORM)** + versioning + SSE-KMS, EU region.
- **Secrets**: AWS Secrets Manager / SSM Parameter Store injected as task env (`JWT_SECRET`, DB + storage creds).
- **CORS_ORIGINS** = the CloudFront/Amplify domain.

## Health probes
- `GET /health/live` — process up (liveness; never touches the DB).
- `GET /health/ready` — env + DB + storage all up (readiness gate for the LB).
- `GET /health` — aggregate: `ok` / `degraded` (storage soft-down) / `down` (DB down).

## Backup & restore
- **DB backup**: RDS automated snapshots + PITR (retain ≥7 days). Self-hosted: nightly
  `pg_dump --format=custom` to the EU S3 backup bucket; weekly base backup + WAL archiving for PITR.
- **DB restore**: provision from snapshot/PITR to a new instance; smoke-test `GET /health/ready`; cut over.
  Verify `app.verify_audit_chain(tenant)` returns true post-restore (audit integrity).
- **Object storage**: S3 versioning + Object Lock means documents are immutable/recoverable; replicate to a
  second EU region for DR.
- **Lower environments**: production data is NEVER copied unmasked to staging/dev (Invariant 10) — use synthetic
  or masked datasets.

## Logging & monitoring
- Structured logs to stdout (12-factor) → CloudWatch Logs (or your aggregator). Audit trail is in-DB (hash-chained).
- Monitor: `/health/ready` (uptime), DB connections/replica lag, Redis depth, queue backlog, 5xx + rate-limit 429s.
