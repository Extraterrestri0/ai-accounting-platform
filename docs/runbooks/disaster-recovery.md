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

## Database — backup configuration (EC2 path) — ⚠️ TO IMPLEMENT (beta blocker)
The EC2 Postgres node must have, before beta with real data:
- `pgBackRest` (or WAL-G) doing **base backup + WAL archiving to an EU S3 bucket** (SSE-KMS), retention ≥ 14 days, enabling PITR.
- A streaming **read replica** (or at least daily verified base backups) for RTO.
- Backups encrypted + access-restricted; documented in user-data/config-management (kept out of TF to avoid drift per `database.tf`).

## Database — restore validation (must be drilled before beta)
**Restore drill (run in a staging account, not prod):**
1. Provision a fresh instance from the latest backup/snapshot (RDS: restore-to-point-in-time; EC2: restore base backup + replay WAL to a target time).
2. Apply pending migrations if any (`npm run migrate`), then `npm run migrate:validate` to confirm schema + RLS integrity.
3. Smoke-test: run the read-only health checks + a tenant-scoped query under app context; verify **audit-chain integrity** (`GET /audit/verify`) on a sample tenant.
4. Record **actual RTO** (time to usable DB) and **actual RPO** (gap between failure point and last restorable time). Compare to targets above.
5. **Cadence:** restore drill **before beta** and **quarterly** thereafter. Sign off in this file.

## Migration rollback strategy
- Migrations are **expand-contract** and **forward-fix preferred.** All 36 have a `.down.sql`, but several downs are **dev-only** (e.g., `0035` re-adds a narrow CHECK that fails if v2-status rows exist).
- **Policy:** in production, **never roll a data-bearing migration backward.** Recover via (a) a new corrective forward migration, or (b) PITR restore to before the bad migration. Down-scripts are for local/dev resets only.
- CI runs `migrate:validate` which includes a **rollback smoke** (down+up of the latest migration in a rolled-back transaction) — proves the down script is valid without mutating data.

## Storage recovery (documents + SAF-T artifacts)
- S3 bucket has **versioning + Object Lock (COMPLIANCE)** + SSE-KMS + public-access-block + TLS-only policy. Objects **cannot be deleted/overwritten** within retention → accidental loss is prevented by design.
- Recovery: restore a prior object **version** (`aws s3api list-object-versions` → `get-object --version-id`). The DB stores `storage_key` + `sha256` for integrity verification on restore.
- ⚠️ EU-residency precludes cross-region replication; mitigate with versioning + Object Lock (single-region durability is 11x9s).

## Gaps tracked
- 🔴 **EC2 Postgres automated backups + PITR not configured in TF** (beta blocker).
- 🔴 **No restore drill performed** (beta blocker — backups unproven).
- 🟠 RPO/RTO are **targets, not yet measured.**
- 🟠 Weekly backup-freshness check + SNS alert not yet wired.
