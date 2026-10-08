# Beta Exit Criteria

> When may Controlled Beta graduate to **public-launch candidate**? Only when **all** the gates below hold for the **full minimum duration**, *and* the public-launch hardening blockers are cleared. Scope: [CONTROLLED_BETA_LAUNCH_PLAN.md](CONTROLLED_BETA_LAUNCH_PLAN.md). Risks: [BETA_RISK_REGISTER.md](BETA_RISK_REGISTER.md). Measurement: [First 30 Days Monitoring Plan](../runbooks/beta-first-30-days-monitoring.md).

Exit ≠ "no incidents ever." Exit = **the trustworthy loop held under real use, every safety invariant stayed green, and the deferred launch-hardening items are done.**

---

## Part A — Safety gates (all must be **true** for the entire minimum duration)

| # | Gate | Threshold (measurable) | How verified |
|---|---|---|---|
| A1 | **No critical accounting errors** | **0** unresolved correctness incidents (wrong posting reaching the ledger, wrong VAT treatment/amount surviving review) for the full duration | Daily failed-posting + VAT spot-checks; incident log; user reports |
| A2 | **No RLS violations** | **0** cross-tenant accesses; FORCE-RLS coverage stays at 0 unprotected tables across every deploy | Onboarding + per-deploy isolation tests; `migrate:validate` in CI |
| A3 | **No ledger imbalance** | **0** unbalanced posted entries; reversals fully offset | Property-based ledger tests green; daily balance check; restore-drill ledger check |
| A4 | **No unrecoverable backup issue** | **0** backups that fail integrity or restore; backup freshness stayed < 24 h throughout | Daily freshness check; weekly restore drill all-green |
| A5 | **Successful restore drill (real infra)** | ≥ **1 cloud restore drill** (`pg-restore-drill.sh`, AWS creds) all-green proving SSE-KMS upload + S3 Object-Lock retention, **plus** the weekly local/cloud drill cadence green throughout | DR sign-off log entries |
| A6 | **No broken audit chain** | **0** `verify_audit_chain=false` results across the cohort for the full duration | Daily `GET /audit/verify` / SQL check |

Any A-gate breaching during beta **resets** the minimum-duration clock for that gate until the root cause is fixed and the gate is green again.

---

## Part B — Quality & operations gates

| # | Gate | Threshold | Notes |
|---|---|---|---|
| B1 | **OCR accuracy** | Once the managed EU vendor is integrated: **≥ 95% field-level accuracy** on a labeled BG-invoice eval set (key fields: supplier EIK/VAT, invoice no., date, net, VAT, total). Until vendor integration: a **measured correction-rate baseline** is recorded and the vendor target is signed off as the launch gate. | Extraction eval (CLAUDE.md §12). Human review remains mandatory regardless. |
| B2 | **Support response time** | Sustained: **P1 < 4 h**, **P2 < 1 business day**, **P3 < 3 business days**, measured from report to first substantive response | Beta support owner logs; review weekly |
| B3 | **Minimum beta duration** | **≥ 6 weeks** of active use, with **≥ 2 firms** running the **full core loop** on real data and a **meaningful volume of approved postings** (e.g. ≥ 100 across the cohort) — not just logins | Cohort activity log; posting counts |
| B4 | **Operational stability** | No **sev-1** open at exit; **0** unresolved sev-2; queue/DLQ healthy (no chronic backlog); 5xx rate nominal | Monitoring Plan + incident log |
| B5 | **Period-close exercised** | At least one **VAT period assembled → validated → exported** and at least one **accounting period locked**, end-to-end, by a real user | VAT export artifact; period-lock audit entry |

---

## Part C — Public-launch hardening blockers (must be cleared to become a launch candidate)

These were explicitly deferred from beta (CLAUDE.md / [BETA_READINESS_REPORT.md](../BETA_READINESS_REPORT.md) §High/Medium). Beta can run without them; **public launch cannot.**

1. **Cloud DR fully proven** — cloud restore drill green (A5) + backup cron installed + production-scale RTO measured; PITR (WAL-G/pgBackRest) decision made.
2. **Managed EU OCR vendor integrated + accuracy-evaluated** (B1), zero-retention.
3. **Egress restricted** to approved EU endpoints (app/worker SGs).
4. **Observability completed** — metrics scraper + dashboards, ALB/ECS/app/queue/audit-verify alarms, platform-wide **correlation-id + PII-redacted structured logging**, distributed tracing.
5. **Auth/permission test matrices in CI** — MFA, session rotation, lockout, RBAC allow/deny.
6. **Secret rotation + scheduled audit-chain verification** (automated, alerting).
7. **Access-token storage hardened** (in-memory / BFF cookie).
8. **Remaining CI lanes proven in GitHub Actions** — SAF-T pipeline e2e (Redis), dedicated rls-isolation seed, gitleaks secret-scan job.
9. **§15 governance ADRs** for anything built beyond strict MVP (SAF-T, etc.), and the SAF-T XML enablement pre-reqs if turning the flag on (NRA XSD/values + Object-Lock bucket).

---

## Exit decision

**Graduate to public-launch candidate when:** Part A all-green for ≥ 6 weeks (B3), Part B met, **and** Part C cleared. The decision is made jointly by **Platform lead + Eng lead** and recorded (date, metrics snapshot, sign-off) in [BETA_READINESS_REPORT.md](../BETA_READINESS_REPORT.md), mirroring the DR sign-off pattern.

**Do not exit on schedule alone.** If a Part-A gate is amber, beta continues. A controlled beta that runs longer is cheaper than a public launch that leaks a tenant or loses a ledger.
