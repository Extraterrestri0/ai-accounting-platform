# Repository bootstrap

```bash
git clone <repo-url> && cd ai-accounting-platform
# API
cd apps/api && npm install && npm run typecheck && npm run lint && npm run build && npm test
# Web
cd ../web && npm install && npm run typecheck && npm run lint && npm run build
# Full stack
cd ../.. && cp .env.example .env && docker compose up --build
```
One PR per change; migrations are forward-only (`db/migrations/NNNN_*.up.sql` + matching `.down.sql`).
Never commit `.env`. The runtime DB role is `app_user` (RLS subject) — never the owner.
