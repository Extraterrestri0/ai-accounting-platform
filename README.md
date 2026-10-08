# AI Accounting Platform

AI-powered, **Bulgarian-first, EUR-native** accounting platform for small businesses, freelancers, and
accountants. Automates document intake, bookkeeping suggestions, VAT, invoicing, and reporting — with a
human always in the loop for anything that touches money or state.

> Not an ERP. The AI **proposes**; a human **approves**; the ledger is **immutable**; every change is **audited**.

## Monorepo layout
```
apps/api    NestJS modular monolith (PostgreSQL + RLS, Redis/BullMQ, S3 object storage)
apps/web    Next.js App Router (static export) — dashboard + MVP screens
infra       Dockerfiles, nginx, docker-compose validation
docker-compose.yml   full local stack (db, redis, minio, migrate, api, worker, web)
```

## Quick start (Docker)
```bash
cp .env.example .env        # fill real values; PGUSER must be app_user (RLS subject)
docker compose up --build   # web :8080 · api :3000 (/health) · minio :9001
```

## Quick start (local dev, real backend)
Requires a reachable **PostgreSQL 16** + **Redis**. Four processes:
```bash
cd apps/api && npm install && npm run build
npm run migrate                                   # applies db/migrations (as the owner/superuser)
psql "$DATABASE_URL" -f scripts/seed-dev.sql      # demo company + login user demo@demo.bg / Demo1234!

node -r ./scripts/load-env.js dist/main.js        # API  → :3000   (reads apps/api/.env)
node -r ./scripts/load-env.js dist/worker.js      # WORKER (REQUIRED: scan→OCR→extraction consumers)

# Web (separate terminal, from repo root)
npm run dev --workspace apps/web                  # → http://localhost:3001  (uses .env.local → API :3000)
```
Open **http://localhost:3001**, register or log in with the demo account, then upload → review → post → VAT → invoice → reports.
The web app always uses the real API in local dev; set `NEXT_PUBLIC_USE_MOCK=true` only for a backend-free preview.

> **Document processing needs the worker running.** Without `dist/worker.js`, uploads stay in `scanning`.
> With no `OCR_VENDOR_URL`, a deterministic dev OCR extracts sample invoice data so the workflow still completes.

### Google login (optional)
1. https://console.cloud.google.com/apis/credentials → **Create credentials → OAuth client ID** → **Web application**.
2. **Authorized redirect URI:** `http://localhost:3000/auth/google/callback` · **Authorized JS origin:** `http://localhost:3001`.
3. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `apps/api/.env`, restart the API.
   Until set, the Google button shows a friendly "not configured" message and email/password login works normally.

## Validate the full workflow
```bash
cd apps/api && ./scripts/e2e.sh          # add USE_DOCKER=1 to start Postgres via compose
```

## Architecture invariants (enforced, not aspirational)
1. Tenant isolation via PostgreSQL RLS  2. Immutable ledger (reversing entries only)
3. Append-only, hash-chained audit  4. AI proposes, never commits  5. Human-in-the-loop for money/state
6. Deterministic validators outrank AI  7. EU-resident, zero-retention AI  8. EUR functional, exact decimals
9. UI permissions are hints; backend re-authorizes  10. Secrets never in code; prod data never copied unmasked

## Documentation
- `DEPLOYMENT.md` — infrastructure diagram, deploy steps (Netlify/Vercel/AWS), backup/restore, monitoring.
- `apps/api/docs/` — per-module design notes.

## License
Proprietary — see `LICENSE`.
