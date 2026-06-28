#!/usr/bin/env bash
# =====================================================================
# One-shot deploy for the single EU-Sofia VPS (185.52.207.143).
# Idempotent: safe to re-run. Fetch + run with a single short line:
#   curl -fsSL https://raw.githubusercontent.com/Extraterrestri0/ai-accounting-platform/<sha>/infra/deploy-sofia.sh -o deploy.sh && bash deploy.sh
# Brings up the full stack (db,redis,minio,api,worker,web,caddy) with HTTPS,
# generates production secrets once, seeds the demo company, installs a backup cron.
# =====================================================================
set -euo pipefail

APP_HOST="app.185-52-207-143.sslip.io"
REPO="https://github.com/Extraterrestri0/ai-accounting-platform.git"
BRANCH="feat/mvp-modules"
DC="docker compose -f docker-compose.deploy.yml --env-file .env.deploy"

echo "==> 1/8 swap (so the build can't OOM)"
sudo swapon --show | grep -q . || { sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null; }

echo "==> 2/8 system packages"
sudo apt-get update -y && sudo apt-get install -y curl git ufw openssl

echo "==> 3/8 Docker + Compose plugin"
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sudo sh
sudo docker compose version >/dev/null

echo "==> 4/8 firewall (22/80/443 only)"
sudo ufw allow 22/tcp >/dev/null && sudo ufw allow 80/tcp >/dev/null && sudo ufw allow 443/tcp >/dev/null && sudo ufw --force enable >/dev/null

echo "==> 5/8 code (clone or update to latest ${BRANCH})"
cd ~
if [ -d mgi-delta/.git ]; then
  cd mgi-delta && git fetch --quiet origin "$BRANCH" && git reset --hard "origin/$BRANCH"
else
  git clone --quiet -b "$BRANCH" "$REPO" mgi-delta && cd mgi-delta
fi

echo "==> 6/8 production secrets (.env.deploy — generated once, kept on re-runs)"
if [ ! -f .env.deploy ]; then
  cat > .env.deploy <<EOF
APP_HOST=${APP_HOST}
PGDATABASE=accounting
POSTGRES_SUPERUSER=app_owner
POSTGRES_SUPERUSER_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9')
PGUSER=app_user
PGPASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9')
JWT_SECRET=$(openssl rand -hex 32)
STORAGE_ACCESS_KEY=mgi$(openssl rand -hex 6)
STORAGE_SECRET_KEY=$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9')
STORAGE_BUCKET=documents
STORAGE_REGION=eu-central-1
STORAGE_RETAIN_DAYS=3650
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MAIL_FROM=no-reply@${APP_HOST}
RESEND_API_KEY=
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=300
EOF
  chmod 600 .env.deploy
  echo "    created"
else
  echo "    already exists — keeping current secrets"
fi

echo "==> 7/8 build + start the stack (first build takes 5-10 min)"
sudo $DC up -d --build

echo "    waiting for HTTPS health (Caddy fetches the certificate)…"
ok=""
for i in $(seq 1 60); do
  sleep 6
  if curl -fsS "https://${APP_HOST}/api/health/ready" >/dev/null 2>&1; then ok=1; break; fi
done
echo -n "    HEALTH: "; curl -s "https://${APP_HOST}/api/health/ready" 2>/dev/null || echo "(not ready yet — see logs)"; echo

echo "==> 8/8 seed demo company + nightly backup cron"
sudo $DC exec -T db psql -U app_owner -d accounting < apps/api/scripts/seed-dev.sql >/dev/null 2>&1 || echo "    (seed skipped — maybe already seeded)"
cat > ~/mgi-delta/backup.sh <<'BK'
#!/usr/bin/env bash
set -euo pipefail; cd ~/mgi-delta; D=~/mgi-backups; mkdir -p "$D"; TS=$(date -u +%Y%m%dT%H%M%SZ); O="$D/accounting-$TS.dump"
sudo docker compose -f docker-compose.deploy.yml exec -T db pg_dump -U app_owner -d accounting -Fc -Z6 > "$O"
sha256sum "$O" > "$O.sha256"; find "$D" -name 'accounting-*.dump*' -mtime +14 -delete; echo "backup: $O"
BK
chmod +x ~/mgi-delta/backup.sh
( crontab -l 2>/dev/null | grep -v 'mgi-delta/backup.sh' ; echo "0 2 * * * $HOME/mgi-delta/backup.sh >> $HOME/mgi-backups/backup.log 2>&1" ) | crontab -

echo ""
echo "============================================================"
if [ -n "$ok" ]; then echo " ✅ ГОТОВО → https://${APP_HOST}"; else echo " ⚠ Стекът е стартиран, но health още не отговаря — изчакай 1-2 мин и пробвай URL-а."; fi
echo "    Вход: demo@demo.bg / Demo1234!"
echo "    Логове: cd ~/mgi-delta && sudo docker compose -f docker-compose.deploy.yml logs -f api caddy"
echo "============================================================"
