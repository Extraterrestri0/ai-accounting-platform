# First 30 Days Monitoring Plan

> What to watch every day for the first 30 days of Controlled Beta, the signal source, the healthy threshold, and what to do on breach. Pairs with the [Beta Operations Runbook](beta-operations.md) (procedures) and the [Risk Register](../beta/BETA_RISK_REGISTER.md) (why). Many checks are **manual during beta** by design — the metrics scraper, ALB/ECS/app alarms, and correlation-id logging are public-launch items ([observability.md](observability.md)); the small cohort makes manual coverage feasible.

Signal sources available today:
- `GET /health` · `/health/live` · `/health/ready` — DB / storage / queue component health.
- `GET /metrics` — prom-client (process + SAF-T counters: `saft_queue_depth`, `saft_failed_jobs`, `saft_stuck_processing_exports`, `saft_workers_connected`, …).
- `GET /audit/verify` (`AUDIT_READ`) — audit chain validity for the active company.
- CloudWatch alarms + SNS — RDS (CPU/storage/connections) + Redis (engine CPU).
- App/worker logs; backup artifacts (S3 prefix or local backup dir) + `*.manifest.json`.

---

## Phase 4 — Daily monitoring checklist

Run once per business day (twice in week 1). ✅ all green → log the date and move on. Any ✗ → follow *On breach*.

| # | What | How (signal) | Healthy threshold | On breach |
|---|---|---|---|---|
| 1 | **Audit chain verification** | `GET /audit/verify` per company, or SQL `app.verify_audit_chain(tenant_id)` for every distinct tenant in `audit_events` | **all `true`** | **sev-1** — freeze writes for the tenant, restore from verified backup, RCA (Ops §3). |
| 2 | **Failed jobs / DLQ** | `/metrics`: `saft_failed_jobs`, `saft_stuck_processing_exports`; worker DLQ for the doc pipeline | `failed_jobs=0`, `stuck=0`, DLQ not growing | Inspect + re-drive DLQ (idempotent); restart/scale worker (Ops §6). |
| 3 | **Failed postings** | App logs for posting-service errors; rate of `409 PeriodLockedError` / balance rejections | No service-level errors; rejections are expected/explained | Triage per Ops §5; escalate true service errors to Eng lead + DBA. |
| 4 | **Failed migrations** | Deploy logs; `schema_migrations` count stable; `migrate:validate` on any deploy | No failed/partial migration; count matches expected | Forward-fix or PITR — **never** roll a data-bearing migration backward in prod (DR runbook). |
| 5 | **Backup success** | Newest backup artifact + matching `*.manifest.json` | A fresh artifact exists **< 24 h** old, integrity-checked | **sev-1/2** — re-run `pg-backup.sh`; if cron, fix the timer/IAM; block reliance on stale backup. |
| 6 | **Restore freshness** | DR sign-off log — date of last green restore drill | Last successful drill **within 7 days** (weekly cadence) | Run `pg-restore-drill.sh` (or `.local.sh`); a failing drill is a launch-blocking regression. |
| 7 | **OCR failures** | Documents stuck in `processing`; empty/low extractions; worker health | No stuck docs; correction-rate within baseline | Re-enqueue / stale-processing recovery; reviewer enters fields manually (Ops §6); log for B1 baseline. |
| 8 | **Bank reconciliation errors** | Import failures; unmatched-transaction count/age | Imports succeed; unmatched cleared promptly | Re-import (idempotent); match manually; escalate persistent mismatches (Ops §7). |
| 9 | **Auth failures** | App logs: 401 / MFA-failure / lockout volume | No abnormal spike | Investigate spikes (possible attack/misconfig); revoke/rotate sessions if needed; Security owner. |
| 10 | **5xx errors** | `/health` synthetic check; app/ALB logs for 5xx | `/health` healthy; 5xx rate nominal | Identify failing component via `/health/ready`; roll back bad deploy (DR); page on-call if sustained. |

> **Coverage note:** items 3, 9, 10 have **no automated alarm yet** (no app-metric scraper / ALB alarm) — they are **manual log reviews** during beta. Items 1, 5, 6, 7 should be **scripted into a daily ops job** that posts results to the support channel; wiring `GET /audit/verify` + backup-freshness as scheduled alarms is the first observability upgrade toward launch.

---

## 30-day cadence

### Week 1 — stand-up & prove
- **Before first invite:** confirm Entry Criteria #3 (backup cron producing fresh artifacts) and #5 (named support owner) — the two open gates ([Launch Plan](../beta/CONTROLLED_BETA_LAUNCH_PLAN.md) Phase 2).
- Run the **daily checklist twice per day**.
- After each onboarding: RLS isolation test (Ops §2) + audit-chain verify (§3) + loop smoke.
- Run a **restore drill** at the start of week 1 to confirm the cohort's real data restores.
- Establish the **OCR correction-rate baseline** (B1) and **posting-latency** feel at real volume.

### Weeks 2–4 — operate & measure
- Daily checklist once per business day (escalate anything amber same-day).
- **Weekly:** restore drill (record in DR sign-off log); backup-freshness audit; queue/DLQ trend review; support response-time review (B2); incident-log review.
- Track Exit-Criteria metrics continuously: A1–A6 must stay green; accumulate B3 duration + posting volume.
- **First cloud restore drill** (A5) as soon as AWS creds are available — proves SSE-KMS upload + Object-Lock retention beyond the local-equivalent drill.

### End of 30 days — checkpoint (not exit)
- Snapshot all Part-A gates (must be all-green) and Part-B/C progress.
- Decide: **continue beta** (default; minimum duration is ≥ 6 weeks — B3), **expand cohort** (if all-green and within caps), or **pause/contain** (if any sev-1/2 unresolved).
- Record the checkpoint summary; carry open hardening items (Part C) into the launch-readiness plan.

---

## Incident severity & response (recap)

| Severity | Trigger | Target first response | Owner |
|---|---|---|---|
| **sev-1** | Cross-tenant leak · broken audit chain · ledger imbalance · unrecoverable/stale backup | **< 1 h**, immediate containment | Platform lead |
| **sev-2** | Posting-service error · worker/DLQ backlog · sustained 5xx · auth-failure spike | **< 4 h** | Platform/Ops on-call |
| **sev-3** | OCR quality · unmatched bank tx · UX/report issues | **< 1 business day** | Beta support owner |

Every sev-1/sev-2 gets a written RCA and, where relevant, a new CI test so the regression can't recur silently.
