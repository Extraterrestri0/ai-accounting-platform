#!/usr/bin/env bash
# =====================================================================
# EC2 Postgres logical backup (Beta Readiness — Phase 2).
# The production RLS-correct runtime is self-managed Postgres on EC2 (RDS cannot grant
# BYPASSRLS). RDS-style automated backups therefore do NOT apply — this script provides them:
# encrypted, retained, integrity-checked logical backups to an EU S3 bucket.
#
# Run on the DB host (or a backup host with network access) via a systemd timer / cron — see
# docs/runbooks/disaster-recovery.md for the schedule + IAM. For 5-minute RPO add WAL archiving
# (pgBackRest/WAL-G); this script gives daily/▶hourly logical backups (configurable cadence).
#
# Required env:
#   PGHOST PGPORT PGDATABASE                 — source database
#   PGUSER PGPASSWORD (or ~/.pgpass)         — a read-capable backup role
#   BACKUP_S3_BUCKET                         — EU S3 bucket (versioned + SSE-KMS, see storage.tf)
#   BACKUP_KMS_KEY_ID                        — KMS key for SSE-KMS server-side encryption
# Optional:
#   BACKUP_PREFIX (default "pg")  BACKUP_RETENTION_DAYS (default 14)  AWS_REGION
# =====================================================================
set -euo pipefail

: "${PGHOST:?}"; : "${PGDATABASE:?}"; : "${BACKUP_S3_BUCKET:?}"; : "${BACKUP_KMS_KEY_ID:?}"
PGPORT="${PGPORT:-5432}"
PREFIX="${BACKUP_PREFIX:-pg}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DAYPATH="$(date -u +%Y/%m/%d)"
WORKDIR="$(mktemp -d)"
DUMP="$WORKDIR/${PGDATABASE}-${TS}.dump"
KEY="${PREFIX}/${DAYPATH}/${PGDATABASE}-${TS}.dump"
trap 'rm -rf "$WORKDIR"' EXIT

echo "▶ pg_dump (custom format, compressed) → $DUMP"
pg_dump -h "$PGHOST" -p "$PGPORT" -d "$PGDATABASE" -Fc -Z6 -f "$DUMP"

echo "▶ integrity check (pg_restore --list)"
pg_restore --list "$DUMP" >/dev/null   # fails non-zero if the dump is corrupt/truncated

SHA="$(sha256sum "$DUMP" | awk '{print $1}')"
SIZE="$(stat -c%s "$DUMP")"
echo "  sha256=$SHA size=${SIZE}B"

echo "▶ upload (SSE-KMS) → s3://${BACKUP_S3_BUCKET}/${KEY}"
aws s3 cp "$DUMP" "s3://${BACKUP_S3_BUCKET}/${KEY}" \
  --sse aws:kms --sse-kms-key-id "$BACKUP_KMS_KEY_ID" \
  --metadata "sha256=${SHA},database=${PGDATABASE},created=${TS}"

# Manifest (sha256/size/timestamp) alongside the dump — used by the restore drill to verify integrity.
echo "{\"database\":\"${PGDATABASE}\",\"timestamp\":\"${TS}\",\"key\":\"${KEY}\",\"sha256\":\"${SHA}\",\"size\":${SIZE}}" > "$WORKDIR/manifest.json"
aws s3 cp "$WORKDIR/manifest.json" "s3://${BACKUP_S3_BUCKET}/${KEY}.manifest.json" \
  --sse aws:kms --sse-kms-key-id "$BACKUP_KMS_KEY_ID"

echo "▶ retention prune (> ${RETENTION_DAYS} days)"
CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%s)"
aws s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix "${PREFIX}/" \
  --query 'Contents[].{K:Key,T:LastModified}' --output text 2>/dev/null | while read -r k t; do
  [ -z "$k" ] && continue
  OBJ_TS="$(date -u -d "$t" +%s 2>/dev/null || echo 0)"
  if [ "$OBJ_TS" -gt 0 ] && [ "$OBJ_TS" -lt "$CUTOFF" ]; then
    echo "  prune $k"; aws s3 rm "s3://${BACKUP_S3_BUCKET}/${k}"
  fi
done

echo "✅ backup complete: s3://${BACKUP_S3_BUCKET}/${KEY} (sha256 ${SHA})"
