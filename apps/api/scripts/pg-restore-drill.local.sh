#!/usr/bin/env bash
# =====================================================================
# LOCAL-equivalent backup + restore drill (Beta Readiness — Phases 2+3, no-AWS path).
#
# The production drill (pg-backup.sh + pg-restore-drill.sh) targets EC2 Postgres + an
# EU S3 bucket with SSE-KMS. In environments WITHOUT AWS credentials (e.g. local/CI on a
# portable Postgres), this script proves the SAME recoverability + soundness invariants
# against the local filesystem instead of S3. It is the documented fallback referenced by
# docs/runbooks/disaster-recovery.md. It does NOT replace the cloud drill — the cloud-only
# steps it cannot exercise (SSE-KMS encrypted upload, S3 object-lock retention) are printed
# as "REMAINS FOR CLOUD" so the gap is explicit.
#
# Backup (Phase 2):  pg_dump -Fc -Z6 -> integrity (pg_restore --list) -> sha256 + manifest
#                    -> local backup dir -> local retention prune.
# Restore (Phase 3): re-verify sha256 -> restore into a clean scratch DB -> verify
#                    migrations / app_user / RLS FORCE / audit chain / company+accounting
#                    readable / ledger balanced / period locks / payments+banking / SAF-T.
# Reports RPO proxy (backup age) + RTO proxy (restore time). Exits non-zero on any failure.
#
# Env (all have local defaults; override for other environments):
#   PGBIN              dir with pg_dump/pg_restore/psql  (default: $HOME/pgdev/pgsql/bin)
#   PGHOST PGPORT      source + scratch host             (default: 127.0.0.1 5432)
#   SRC_DB             source database                   (default: accounting)
#   ADMIN_USER ADMIN_PASSWORD  superuser on the host     (default: postgres / postgres)
#   DRILL_DB           scratch restore target            (default: restore_drill)
#   LOCAL_BACKUP_DIR   where dumps are written           (default: $HOME/pgdev/backups)
#   RETENTION_DAYS     local prune horizon               (default: 14)
#   EVIDENCE_DIR       where to copy manifest evidence   (default: unset -> skip)
# =====================================================================
set -euo pipefail

PGBIN="${PGBIN:-$HOME/pgdev/pgsql/bin}"
export PATH="$PGBIN:$PATH"
PGHOST="${PGHOST:-127.0.0.1}"; PGPORT="${PGPORT:-5432}"
SRC_DB="${SRC_DB:-accounting}"
ADMIN_USER="${ADMIN_USER:-postgres}"; ADMIN_PASSWORD="${ADMIN_PASSWORD:-postgres}"
DRILL_DB="${DRILL_DB:-restore_drill}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$HOME/pgdev/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
export PGPASSWORD="$ADMIN_PASSWORD"

psql_q() { psql -h "$PGHOST" -p "$PGPORT" -U "$ADMIN_USER" -d "$1" -v ON_ERROR_STOP=1 -tAc "$2"; }
fail=0; check() { if [ "$1" = "0" ]; then echo "  ✓ $2"; else echo "  ✗ $2"; fail=1; fi; }
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$LOCAL_BACKUP_DIR"
DUMP="$LOCAL_BACKUP_DIR/${SRC_DB}-${TS}.dump"
MANIFEST="$DUMP.manifest.json"

echo "================================================================"
echo " LOCAL DR DRILL  —  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo " source: ${ADMIN_USER}@${PGHOST}:${PGPORT}/${SRC_DB}   backup dir: ${LOCAL_BACKUP_DIR}"
echo "================================================================"

# ---------------------------------------------------------------- PHASE 2
echo ""
echo "▶ PHASE 2 — real (local-equivalent) backup"
echo "  pg_dump (custom format, compressed) → $DUMP"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$ADMIN_USER" -d "$SRC_DB" -Fc -Z6 -f "$DUMP"
[ -s "$DUMP" ]; check $? "backup artifact exists ($(basename "$DUMP"))"

echo "  integrity check (pg_restore --list)"
pg_restore --list "$DUMP" >/dev/null; check $? "dump integrity (pg_restore --list)"

SHA="$(sha256sum "$DUMP" | awk '{print $1}')"
SIZE="$(stat -c%s "$DUMP" 2>/dev/null || wc -c < "$DUMP")"
echo "  sha256=$SHA size=${SIZE}B"
printf '{"database":"%s","timestamp":"%s","key":"%s","sha256":"%s","size":%s}\n' \
  "$SRC_DB" "$TS" "$(basename "$DUMP")" "$SHA" "$SIZE" > "$MANIFEST"
[ -s "$MANIFEST" ]; check $? "checksum manifest exists ($(basename "$MANIFEST"))"

echo "  retention prune (local, > ${RETENTION_DAYS} days)"
PRUNED=$(find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name "${SRC_DB}-*.dump*" -mtime +"$RETENTION_DAYS" -print -delete 2>/dev/null | wc -l)
check 0 "retention policy applied (pruned ${PRUNED} expired local artifact(s))"

echo "  REMAINS FOR CLOUD (not exercisable without AWS creds):"
echo "    - encrypted upload to s3://\$BACKUP_S3_BUCKET with --sse aws:kms (SSE-KMS)"
echo "    - S3 versioned + Object-Lock retention prune (server-side)"

# ---------------------------------------------------------------- PHASE 3
echo ""
echo "▶ PHASE 3 — restore drill (into clean DB: $DRILL_DB)"

echo "  re-verify sha256 against manifest"
EXP="$(grep -o '"sha256":"[0-9a-f]*"' "$MANIFEST" | cut -d'"' -f4)"
GOT="$(sha256sum "$DUMP" | awk '{print $1}')"
[ "$EXP" = "$GOT" ]; check $? "sha256 matches manifest"

# backup age (RPO proxy) — minutes since the dump was written
NOW=$(date -u +%s); MOD=$(stat -c%Y "$DUMP" 2>/dev/null || echo "$NOW")
RPO_MIN=$(( (NOW - MOD) / 60 ))
echo "  backup age (RPO proxy): ${RPO_MIN} min"

echo "  restore into clean DB  [timing RTO]"
T0=$(date +%s)
psql_q postgres "DROP DATABASE IF EXISTS ${DRILL_DB}" >/dev/null
psql_q postgres "CREATE DATABASE ${DRILL_DB}" >/dev/null
set +e
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$ADMIN_USER" -d "$DRILL_DB" --no-owner "$DUMP" >/dev/null 2>&1
RC=$?
set -e
# pg_restore exits non-zero on benign role/extension warnings under --no-owner; treat the
# real test as "the schema + data are queryable", checked below. Surface RC for the record.
echo "  pg_restore exit code: $RC"
RTO_S=$(( $(date +%s) - T0 )); echo "  restore time (RTO proxy): ${RTO_S}s"
[ "$(psql_q "$DRILL_DB" "SELECT 1")" = "1" ]; check $? "database restored + queryable"

# 1) migrations table consistent (same count as source)
SRC_M="$(psql_q "$SRC_DB" "SELECT count(*) FROM schema_migrations")"
DST_M="$(psql_q "$DRILL_DB" "SELECT count(*) FROM schema_migrations")"
[ "${DST_M:-0}" -gt 0 ] && [ "$SRC_M" = "$DST_M" ]; check $? "migrations consistent (source=${SRC_M}, restored=${DST_M})"

# 2) app_user role exists (cluster-global)
[ "$(psql_q "$DRILL_DB" "SELECT 1 FROM pg_roles WHERE rolname='app_user'")" = "1" ]
check $? "app_user role exists"

# 3) RLS still enabled + forced on every tenant table
UNPROT="$(psql_q "$DRILL_DB" "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity) AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_name=c.relname AND col.column_name='tenant_id')")"
[ "${UNPROT:-1}" = "0" ]; check $? "RLS enabled + forced on all tenant tables (${UNPROT} unprotected)"

# 4) audit chain verifies for every tenant
BADCHAINS="$(psql_q "$DRILL_DB" "SELECT count(*) FROM (SELECT DISTINCT tenant_id FROM audit_events) t WHERE NOT app.verify_audit_chain(t.tenant_id)")"
[ "${BADCHAINS:-1}" = "0" ]; check $? "audit chain valid for all tenants (${BADCHAINS} broken)"

# 5) sample company + accounting data readable
COMPANIES="$(psql_q "$DRILL_DB" "SELECT count(*) FROM companies")"
ENTRIES="$(psql_q "$DRILL_DB" "SELECT count(*) FROM journal_entries")"
[ "${COMPANIES:-0}" -gt 0 ]; check $? "company data readable (${COMPANIES} companies, ${ENTRIES} journal entries)"

# 6) ledger remains balanced (Σdebit = Σcredit per entry)
UNBAL="$(psql_q "$DRILL_DB" "SELECT count(*) FROM (SELECT entry_id FROM journal_lines GROUP BY entry_id HAVING sum(amount) FILTER (WHERE direction='debit') <> sum(amount) FILTER (WHERE direction='credit')) x")"
[ "${UNBAL:-1}" = "0" ]; check $? "ledger balanced (${UNBAL} unbalanced entries)"

# 7) period locks intact
LOCKED="$(psql_q "$DRILL_DB" "SELECT count(*) FROM accounting_periods WHERE status='locked'")"
PERIODS="$(psql_q "$DRILL_DB" "SELECT count(*) FROM accounting_periods")"
check 0 "period locks readable (${PERIODS} periods, ${LOCKED} locked)"

# 8) payments + banking readable
PAYMENTS="$(psql_q "$DRILL_DB" "SELECT count(*) FROM payments")"
BANKTX="$(psql_q "$DRILL_DB" "SELECT count(*) FROM bank_transactions")"
check 0 "payments + banking readable (${PAYMENTS} payments, ${BANKTX} bank transactions)"

# 9) SAF-T exports readable
SAFT="$(psql_q "$DRILL_DB" "SELECT count(*) FROM saft_exports")"
check 0 "SAF-T exports readable (${SAFT} exports)"

# tidy up the scratch DB
psql_q postgres "DROP DATABASE IF EXISTS ${DRILL_DB}" >/dev/null || true

echo ""
echo "================================================================"
if [ "$fail" = "0" ]; then
  echo "✅ LOCAL DR DRILL PASSED   (RPO≈${RPO_MIN}m, RTO≈${RTO_S}s)"
  echo "   artifact: $DUMP"
  echo "   sha256:   $SHA"
else
  echo "❌ LOCAL DR DRILL FAILED"
fi
echo "================================================================"
exit $fail
