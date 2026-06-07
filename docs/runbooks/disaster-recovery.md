# Disaster Recovery Runbook

Scope: PostgreSQL, object storage (documents/SAF-T artifacts), Redis, migrations. Goal is **proven** recoverability, not just configured backups.

## RPO / RTO targets (beta)

| System | RPO (max data loss) | RTO (max downtime) | Mechanism |
|---|---|---|---|
| PostgreSQL (RDS path) | **5 min** | **1 h** | Automated backups + 14-day PITR (`backup_retention_period=14`), multi-AZ failover |
| PostgreSQL (EC2 path — RLS-correct) | **24 h** (⚠️ until automated backups added) | **4 h** | ⚠️ **GAP — not yet configured** (see below) |
| Object storage (S3 documents/artifacts) | **0** (versioned, Object-Lock COMPLIANCE) | **< 15 min** | S3 versioning + WORM; objects immutable, recoverable to prior versions |
| Redis (BullMQ) | **N/A** (reconstructable) | **< 30 min** | Multi-AZ + 7-day snapshots; jobs are idempotent/re-requestable |

> **Why two DB paths:** RDS cannot grant `BYPASSRLS`, which the app's invariants require, so production runs **self-managed Postgres on EC2** (`use_rds=false`). The Terraform EC2 instance encrypts storage (KMS) but **does not yet configure automated backups** — this is a **beta blocker** (below).

## Database — backup verification (RDS path)
1. Confirm automated backups + PITR: `aws rds describe-db-instances` → `BackupRetentionPeriod=14`, `LatestRestorableTime` recent (< ~5 min).
2. Confirm encryption: `StorageEncrypted=true`, KMS key = project key.
3. Confirm multi-AZ + deletion protection + final snapshot settings.
4. **Weekly automated check** (CI cron or ops job): assert `LatestRestorableTime` is within RPO and a backup exists in the last 24 h; alert via the SNS topic on failure.

## Database — backup configuration (EC2 path) — ✅ IMPLEMENTED (`scripts/pg-backup.sh`)
`apps/api/scripts/pg-backup.sh` provides automated, encrypted, retained, integrity-checked
logical backups for the self-managed EC2 Postgres runtime:
- **`pg_dump -Fc -Z6`** custom-format dump → integrity-checked with `pg_restore --list` → **uploaded
  to the EU S3 documents/backup bucket with SSE-KMS** (`--sse aws:kms`), plus a `*.manifest.json`
  (sha256/size/timestamp) for restore-time verification.
- **Retention:** prunes objects older than `BACKUP_RETENTION_DAYS` (default 14).
- **Schedule:** install as a **systemd timer / cron** on the DB (or a backup) host:
  ```
  # hourly (cron): 0 * * * *  PGHOST=… BACKUP_S3_BUCKET=… BACKUP_KMS_KEY_ID=… /opt/app/scripts/pg-backup.sh
  ```
  IAM: the host role needs `s3:PutObject`/`ListBucket`/`DeleteObject` on the backup prefix + `kms:GenerateDataKey` on the key.
- **PITR upgrade path (post-beta, for ≤5-min RPO):** add `pgBackRest`/WAL-G WAL archiving + a streaming
  read replica. Logical dumps give the documented RPO below; this is sufficient for beta.

## Database — restore validation — ✅ IMPLEMENTED (`scripts/pg-restore-drill.sh`)
`apps/api/scripts/pg-restore-drill.sh` (run in a **non-prod** account) proves recoverability and soundness:
1. **backup exists** (latest in S3) + **sha256 verified** against the manifest;
2. **restores cleanly** into a fresh scratch DB (measures **RTO**);
3. **schema/migration consistency** (`schema_migrations` populated);
4. **application role** (`app_user`) exists;
5. **RLS still enforced** (every `tenant_id` table FORCE-RLS; 0 unprotected);
6. **audit chain verifies** for every tenant (`app.verify_audit_chain`);
7. **sample accounting data readable** (`journal_entries` count).
It reports **RPO proxy** (backup age) + **RTO proxy** (restore time) and exits non-zero on any failure.
**Cadence:** run **before beta** (sign off below) and **quarterly** thereafter; also wired as a manual CI job.

> Validation note: the underlying invariants this drill checks (migrations apply, RLS FORCE on all
> tenant tables, audit-chain verify, tenant isolation) are **already proven green in CI / locally**
> via `migrate:validate`, the RLS/ledger e2e suites, and the core-loop e2e — so the drill is
> exercising paths known to hold; what remains is running it against a real restored backup.

## Emergency rollback
- **Bad deploy (app):** redeploy the previous image tag (ECS) / flip the feature flag (`SAFT_XML_ENABLED=false`); migrations are backward-compatible (expand-contract) so the prior app runs against the new schema.
- **Bad migration:** **do NOT** roll a data-bearing migration backward (downs are dev-only). Recover via a **corrective forward migration** or **PITR/restore** to before the migration (`pg-restore-drill.sh` validates the restore path).
- **Data corruption / accidental change:** restore from the latest verified backup (or an S3 object version for storage); the ledger/audit are append-only so corruption is detectable via `app.verify_audit_chain`.
- **Storage:** restore prior **object version** (versioned + Object-Lock); never deletable within retention.

## Ownership (RACI)
| Item | Responsible |
|---|---|
| Backup job health (cron/timer + S3 freshness) | **Platform/Ops on-call** |
| Quarterly + pre-beta restore drill + sign-off | **Platform lead** |
| Migration rollback decision (forward-fix vs PITR) | **Eng lead + DBA** |
| Secrets/KMS rotation | **Security owner** |
| Alert response (SNS topic) | **On-call rotation** |

## Sign-off log
- [ ] Pre-beta restore drill executed — date / RPO / RTO / by-whom: __________


## Migration rollback strategy
- Migrations are **expand-contract** and **forward-fix preferred.** All 36 have a `.down.sql`, but several downs are **dev-only** (e.g., `0035` re-adds a narrow CHECK that fails if v2-status rows exist).
- **Policy:** in production, **never roll a data-bearing migration backward.** Recover via (a) a new corrective forward migration, or (b) PITR restore to before the bad migration. Down-scripts are for local/dev resets only.
- CI runs `migrate:validate` which includes a **rollback smoke** (down+up of the latest migration in a rolled-back transaction) — proves the down script is valid without mutating data.

## Storage recovery (documents + SAF-T artifacts)
- S3 bucket has **versioning + Object Lock (COMPLIANCE)** + SSE-KMS + public-access-block + TLS-only policy. Objects **cannot be deleted/overwritten** within retention → accidental loss is prevented by design.
- Recovery: restore a prior object **version** (`aws s3api list-object-versions` → `get-object --version-id`). The DB stores `storage_key` + `sha256` for integrity verification on restore.
- ⚠️ EU-residency precludes cross-region replication; mitigate with versioning + Object Lock (single-region durability is 11x9s).

## Gaps tracked
- ✅ **EC2 Postgres automated backups** — implemented (`scripts/pg-backup.sh`, encrypted + retained + integrity-checked). Install the cron/timer on the host before beta.
- ✅ **Restore drill** — implemented (`scripts/pg-restore-drill.sh`). **Must be executed once on real infra and signed off above before beta** (script authored; not yet run on a live restored backup).
- 🟠 **PITR (≤5-min RPO)** — logical-dump RPO only; WAL archiving (pgBackRest/WAL-G) is the post-beta upgrade.
- 🟠 Weekly backup-freshness check + SNS alert not yet wired (alarm topic exists in `monitoring.tf`).
