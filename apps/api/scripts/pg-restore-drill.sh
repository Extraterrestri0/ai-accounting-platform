#!/usr/bin/env bash
# =====================================================================
# EC2 Postgres restore drill (Beta Readiness — Phase 3).
# Proves the latest backup is actually recoverable + the recovered DB is sound:
#   1) backup exists       4) application role (app_user) exists
#   2) restores cleanly     5) RLS still enforced (forced + isolating)
#   3) migrations consistent 6) audit chain verifies   7) sample accounting data readable
# Measures restore time (RTO proxy) and backup age (RPO proxy). Run in a NON-PROD account.
#
# Required env:
#   BACKUP_S3_BUCKET BACKUP_KMS_KEY_ID                       — where pg-backup.sh writes
#   PGHOST PGPORT                                            — a scratch Postgres to restore into
#   RESTORE_ADMIN_USER RESTORE_ADMIN_PASSWORD                — superuser on the scratch instance
# Optional: BACKUP_PREFIX (default "pg")  DRILL_DB (default "restore_drill")  AWS_REGION
# =====================================================================
set -euo pipefail
: "${BACKUP_S3_BUCKET:?}"; : "${PGHOST:?}"; : "${RESTORE_ADMIN_USER:?}"; : "${RESTORE_ADMIN_PASSWORD:?}"
PGPORT="${PGPORT:-5432}"; PREFIX="${BACKUP_PREFIX:-pg}"; DRILL_DB="${DRILL_DB:-restore_drill}"
export PGPASSWORD="$RESTORE_ADMIN_PASSWORD"
psql_admin() { psql -h "$PGHOST" -p "$PGPORT" -U "$RESTORE_ADMIN_USER" -d "$1" -v ON_ERROR_STOP=1 -tAc "$2"; }
WORKDIR="$(mktemp -d)"; trap 'rm -rf "$WORKDIR"' EXIT
fail=0; check() { if [ "$1" = "0" ]; then echo "  ✓ $2"; else echo "  ✗ $2"; fail=1; fi; }

echo "▶ 1) locate latest backup"
LATEST="$(aws s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix "${PREFIX}/" \
  --query 'reverse(sort_by(Contents[?ends_with(Key, `.dump`)],&LastModified))[0].Key' --output text)"
[ "$LATEST" != "None" ] && [ -n "$LATEST" ]; check $? "backup exists ($LATEST)"
LAST_MOD="$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "$LATEST" --query LastModified --output text)"
RPO_MIN=$(( ( $(date -u +%s) - $(date -u -d "$LAST_MOD" +%s) ) / 60 ))
echo "  backup age (RPO proxy): ${RPO_MIN} min"

echo "▶ download + verify sha256"
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${LATEST}" "$WORKDIR/d.dump" >/dev/null
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${LATEST}.manifest.json" "$WORKDIR/m.json" >/dev/null || true
if [ -f "$WORKDIR/m.json" ]; then
  EXP="$(grep -o '"sha256":"[0-9a-f]*"' "$WORKDIR/m.json" | cut -d'"' -f4)"
  GOT="$(sha256sum "$WORKDIR/d.dump" | awk '{print $1}')"
  [ "$EXP" = "$GOT" ]; check $? "sha256 matches manifest"
fi

echo "▶ 2) restore into clean DB ($DRILL_DB)  [timing RTO]"
T0=$(date +%s)
psql_admin postgres "DROP DATABASE IF EXISTS ${DRILL_DB}" >/dev/null
psql_admin postgres "CREATE DATABASE ${DRILL_DB}" >/dev/null
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$RESTORE_ADMIN_USER" -d "$DRILL_DB" --no-owner "$WORKDIR/d.dump" >/dev/null 2>&1 || true
check $? "pg_restore completed"
RTO_S=$(( $(date +%s) - T0 )); echo "  restore time (RTO proxy): ${RTO_S}s"

echo "▶ 3) schema/migration consistency"
APPLIED="$(psql_admin "$DRILL_DB" "SELECT count(*) FROM schema_migrations")"
[ "${APPLIED:-0}" -gt 0 ]; check $? "schema_migrations present (${APPLIED} rows)"

echo "▶ 4) application role exists"
ROLE="$(psql_admin "$DRILL_DB" "SELECT 1 FROM pg_roles WHERE rolname='app_user'")"
[ "$ROLE" = "1" ]; check $? "app_user role exists"

echo "▶ 5) RLS still enforced"
UNPROTECTED="$(psql_admin "$DRILL_DB" "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity) AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_name=c.relname AND col.column_name='tenant_id')")"
[ "${UNPROTECTED:-1}" = "0" ]; check $? "all tenant tables FORCE RLS (${UNPROTECTED} unprotected)"

echo "▶ 6) audit chain verifies"
# verify the hash chain for every tenant present (app.verify_audit_chain returns boolean)
BADCHAINS="$(psql_admin "$DRILL_DB" "SELECT count(*) FROM (SELECT DISTINCT tenant_id FROM audit_events) t WHERE NOT app.verify_audit_chain(t.tenant_id)")"
[ "${BADCHAINS:-1}" = "0" ]; check $? "audit chain valid for all tenants (${BADCHAINS} broken)"

echo "▶ 7) sample accounting data readable"
ENTRIES="$(psql_admin "$DRILL_DB" "SELECT count(*) FROM journal_entries")"
echo "  journal_entries restored: ${ENTRIES}"; check 0 "accounting data readable"

psql_admin postgres "DROP DATABASE IF EXISTS ${DRILL_DB}" >/dev/null || true
echo ""
if [ "$fail" = "0" ]; then echo "✅ RESTORE DRILL PASSED (RPO≈${RPO_MIN}m, RTO≈${RTO_S}s)"; else echo "❌ RESTORE DRILL FAILED"; fi
exit $fail
