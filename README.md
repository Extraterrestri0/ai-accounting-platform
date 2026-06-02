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

## Quick start (local dev)
```bash
# API
cd apps/api && npm install && npm run build && npm run migrate && npm start   # :3000
# Web (second terminal)
cd apps/web && npm install && NEXT_PUBLIC_API_URL=http://localhost:3000 PORT=3001 npm run dev
```
Without `NEXT_PUBLIC_API_URL`, the web app runs on a bundled mock-data layer (backend-free preview).

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
