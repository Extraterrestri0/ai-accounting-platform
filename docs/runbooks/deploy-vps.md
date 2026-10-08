# Runbook — Host MGI-Delta on a single EU VPS (staging / colleague preview)

Brings up the whole stack (web · api · worker · Postgres · Redis · MinIO) on one EU
server with automatic HTTPS, behind a single hostname. Uses
[`docker-compose.deploy.yml`](../../docker-compose.deploy.yml) + [`infra/Caddyfile`](../../infra/Caddyfile).

**Design:** one public host. Caddy serves the SPA at `/` and reverse-proxies the API at
`/api/*` — same origin, so no CORS or cross-site-cookie issues and only one TLS cert.

> **Data residency (CLAUDE.md §2.7):** pick an **EU** region. For a colleague preview use the
> **synthetic demo data only**. Don't put real customer financial data on a staging box without
> the full production checklist (backups, monitoring, the AWS-EU path in `infra/terraform`).

---

## 0. Provision an EU VPS
- Provider in the EU, e.g. **Hetzner** (Falkenstein/Nuremberg/Helsinki), Scaleway (Paris), OVH, Contabo EU.
- Size: **2 vCPU / 4 GB RAM / 40 GB** is comfortable (extraction/OCR + 6 containers).
- OS: Ubuntu 22.04/24.04. Open inbound **22, 80, 443**. Note the public IP.
- **Hostname** (for HTTPS — Let's Encrypt won't issue for a bare IP):
  - **Have a domain?** Add an `A` record `app.yourdomain.eu → <IP>`.
  - **No domain?** Use **sslip.io**: `app.<IP-with-dashes>.sslip.io` (e.g. `app.203-0-113-7.sslip.io`) resolves to your IP automatically.

## 1. Install Docker
```bash
ssh root@<IP>
curl -fsSL https://get.docker.com | sh
docker compose version   # confirm the compose plugin is present
```

## 2. Get the code on the server
```bash
git clone <your-repo-url> mgi-delta && cd mgi-delta
# (or: rsync/scp the project to the server)
```

## 3. Configure
```bash
cp infra/.env.deploy.example .env.deploy
nano .env.deploy
```
Set at minimum: `APP_HOST` (your domain or sslip.io host), and strong values for
`POSTGRES_SUPERUSER_PASSWORD`, `PGPASSWORD`, `JWT_SECRET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`.
Leave Google blank for now (the button hides itself).

## 4. Launch
```bash
docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d --build
docker compose -f docker-compose.deploy.yml logs -f caddy migrate api
```
Order is automatic: db → bucket + migrate (migrations **and** the `app_user` password) → api/worker/web → Caddy fetches a certificate. First build takes a few minutes.

## 5. Verify
```bash
curl -fsS https://${APP_HOST}/api/health/ready    # {"status":"ok", ...}
```
Open **https://APP_HOST** in a browser — the marketing site loads; `/register` and `/login` work.

## 6. (Optional) seed the demo company so colleagues can log in
```bash
docker compose -f docker-compose.deploy.yml exec -T db \
  psql -U "$(grep POSTGRES_SUPERUSER= .env.deploy | cut -d= -f2)" -d accounting \
  < apps/api/scripts/seed-dev.sql
```
Then share: **https://APP_HOST** · demo login **demo@demo.bg / Demo1234!**

## 7. (Optional) enable Google sign-in for this host
1. Google Console → your OAuth client → **Authorized redirect URI**: `https://APP_HOST/api/auth/google/callback`; **JS origin**: `https://APP_HOST`.
2. Put the client id/secret in `.env.deploy`, then `docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d api`.

## Operations
- **Logs:** `docker compose -f docker-compose.deploy.yml logs -f api worker`
- **Update after a code change:** `git pull && docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d --build`
  - If you change `APP_HOST`, rebuild web (the API URL is baked in): add `web` to that `up` command.
- **DB backup:** `docker compose -f docker-compose.deploy.yml exec -T db pg_dump -U <owner> accounting | gzip > backup.sql.gz`
- **Stop / start:** `docker compose -f docker-compose.deploy.yml down` / `... up -d`
- **Reset everything (DESTRUCTIVE):** `docker compose -f docker-compose.deploy.yml down -v` (drops DB/MinIO volumes; note MinIO object-lock means individual documents can't be deleted before retention — a full volume reset is the way to wipe).

## Security notes
- Datastores (Postgres/Redis/MinIO) are **not** published to the host — only Caddy's 80/443 are public.
- Enable the firewall: `ufw allow 22,80,443/tcp && ufw enable`.
- This is a **staging** setup. For production with real data, use the EU-AWS path
  (`infra/terraform` + `docs/runbooks/deploy-aws-eu.md`) and add backups, monitoring and alerting.
