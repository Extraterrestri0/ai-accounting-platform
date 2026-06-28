#!/usr/bin/env bash
# One command to validate the full MVP workflow locally.
#   USE_DOCKER=1 ./scripts/e2e.sh      # spins up Postgres via docker compose
#   ./scripts/e2e.sh                   # uses an existing Postgres (PG* env vars)
set -euo pipefail
cd "$(dirname "$0")/.."                 # apps/api

: "${PGHOST:=127.0.0.1}"; : "${PGPORT:=5432}"; : "${PGDATABASE:=accte2e}"
: "${PGUSER:=app_user}"; : "${PGPASSWORD:=e2e_app_pw}"
: "${MIGRATION_USER:=app_owner}"; : "${MIGRATION_PASSWORD:=owner_pw}"
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD MIGRATION_USER MIGRATION_PASSWORD
export NODE_ENV=test PORT=3000 JWT_SECRET="${JWT_SECRET:-e2e-secret-32-characters-long-value}" \
  REDIS_URL="${REDIS_URL:-redis://localhost:6379}" \
  STORAGE_ENDPOINT="${STORAGE_ENDPOINT:-http://localhost:9000}" STORAGE_BUCKET="${STORAGE_BUCKET:-documents}" \
  STORAGE_REGION="${STORAGE_REGION:-eu-central-1}" CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:8080}"

if [ "${USE_DOCKER:-0}" = "1" ]; then
  echo "▶ starting Postgres via docker compose…"; ( cd ../.. && docker compose up -d db ); sleep 5
fi

TS_OPTS='{"module":"commonjs","moduleResolution":"node10","ignoreDeprecations":"6.0","experimentalDecorators":true,"emitDecoratorMetadata":true,"esModuleInterop":true,"skipLibCheck":true}'

echo "▶ 1/7 install + build api"; npm install --silent >/dev/null 2>&1 || true; npm run build

echo "▶ 2/7 (re)create database $PGDATABASE"
PGPASSWORD="$MIGRATION_PASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$MIGRATION_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS $PGDATABASE;" -c "CREATE DATABASE $PGDATABASE;"

echo "▶ 3/7 apply migrations (incl. 0035/0036)"; npm run migrate

echo "▶ 4/7 seed deterministic demo data"
PGPASSWORD="$MIGRATION_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$MIGRATION_USER" -d "$PGDATABASE" -f scripts/seed-e2e.sql
PGPASSWORD="$MIGRATION_PASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$MIGRATION_USER" -d "$PGDATABASE" \
  -c "ALTER ROLE $PGUSER LOGIN PASSWORD '$PGPASSWORD';" || true

# `npm test` carries NODE_OPTIONS=--experimental-vm-modules (needed for the ESM-only libxml2-wasm
# in the XSD harness tests) + runs the *.e2e-spec.ts RLS/repository/migration suites that have PG env.
echo "▶ 5/7 backend unit/integration suite (jest)"; npm test

echo "▶ 6/7 end-to-end MVP workflow (real services · live PostgreSQL)"
npx ts-node --compiler-options "$TS_OPTS" test/e2e/e2e-workflow.ts

echo "▶ 7/7 SAF-T v2 pipeline e2e (build→render→XSD→storage→download→audit)"
STORAGE_DRIVER=local DOC_STORAGE_DIR="${DOC_STORAGE_DIR:-/tmp/saft-e2e-storage}" \
  npx ts-node --compiler-options "$TS_OPTS" test/e2e/saft-v2-e2e.ts

echo "✅ E2E validation complete (MVP + SAF-T v2)."
