# Controlled Beta Launch Plan

> Status: **Controlled Beta Ready** as of 2026-06-08 (backup + restore drill executed & signed off — see [disaster-recovery.md](../runbooks/disaster-recovery.md) sign-off log and [BETA_READINESS_REPORT.md](../BETA_READINESS_REPORT.md) blocker #1).
> This plan governs the **first** controlled beta: a tightly bounded cohort on real data, `SAFT_XML_ENABLED=false`. It defines scope (Phase 1) and the entry bar that must be true before the first real user is invited (Phase 2). Operations, monitoring, risks, and exit are in the sibling docs linked at the bottom.

This is a documentation/process plan only — **no business features, accounting logic, AI, or SAF-T changes** are introduced by beta.

---

## Phase 1 — Beta Scope

The principle: ship the **one trustworthy loop** (`upload → extract → review → approve → immutable posting → VAT registers + reports → export`) to a handful of real, supervised users, and nothing speculative. Everything outside the loop is off, flagged off, or never-built (per CLAUDE.md §15).

### Cohort limits

| Dimension | Beta allowance | Rationale |
|---|---|---|
| **Companies (tenants/companies)** | **1–3 firms, ≤ 5 companies total** | Small enough to support manually and to inspect every audit chain daily. Hard cap enforced operationally during onboarding — not a code limit. |
| **Users** | **≤ 10 named users**, operator-provisioned | There is **no self-registration endpoint** (login only — see [local-dev-stack memory]); the operator creates each user, so the cap is naturally enforced. |
| **User roles** | `tenant_admin`, company `owner`, `accountant`, `approver`, `viewer` | RBAC/ABAC already enforced server-side; **money/state actions require Approver + (where applicable) step-up** per CLAUDE.md §2.5. |
| **Data** | Real, low-volume production data | Controlled beta = real data, single-firm scale. No bulk import drills. |

### Modules

**Allowed (the core loop + its read surfaces)** — all already built, human-in-the-loop:

| Area | Modules (nav route) | Beta note |
|---|---|---|
| Overview | Dashboard (`/dashboard`) | Read-only summary. |
| Documents | Documents (`/documents`), Upload (`/upload`), Review (`/review`) | Upload → signed-URL → EU storage (immutable) → extraction → **human Review of every extraction**. |
| Accounting | Posting (`/posting`), VAT (`/vat`), Invoices (`/invoices`), Catalog (`/catalog`), Receivables (`/receivables`), Payables (`/payables`), Banking (`/banking`), Reports (`/reports`) | Approval → **immutable double-entry posting**; VAT **assembly → return → validation → export** (no submission); banking = CSV/XLSX import + reconciliation. |
| System | Audit (`/audit`), Settings (`/settings`) | Audit trail UI + period locking live under Settings. |

**Disabled / not-in-beta (and how):**

| Capability | Beta status | Mechanism |
|---|---|---|
| **SAF-T XML pipeline** | **OFF** | `SAFT_XML_ENABLED=false` → v1 synchronous **dataset** export only; no XML, no async job. The `/saft` page exposes the dataset/readiness view only. |
| **Direct NRA/NAP submission** | **Not built (never in MVP)** | VAT & SAF-T are **export-for-manual-filing** only (CLAUDE.md §15). Humans file with the state. |
| **In-app KEP signing** | **Not built (never in MVP)** | No KEP private keys stored; signing is out-of-band. |
| **AI chat / CFO / anomaly / recommendations / learning loop** | **Not built (never in MVP)** | See AI status below. |
| **Bank reconciliation auto-apply** | **Human-confirmed only** | Matching proposes; a human confirms before any payment record is written. |
| **Client portal, firm cockpit** | **Not in MVP** | Only the Company Workspace shell ships. |
| **Credit/debit notes, proforma, fixed assets/depreciation** | **Not built (never in MVP)** | CLAUDE.md §15. |

> **Module-disable lever during beta:** there is no per-module kill switch beyond `SAFT_XML_ENABLED`. To withdraw a risky surface mid-beta, **revoke the relevant RBAC permission** (server re-authorizes every action; UI is hints only) or redeploy the previous image tag. See the Operations Runbook → *Disable risky modules*.

### Feature flags

| Flag | Beta value | Effect |
|---|---|---|
| `SAFT_XML_ENABLED` | **`false`** (default) | SAF-T stays v1 synchronous dataset; the async XML pipeline + BullMQ job path stay dormant. **This is the only runtime feature flag** (`apps/api/src/config/feature-flags.ts`). |

### Subsystem status

| Subsystem | Beta status | Detail |
|---|---|---|
| **SAF-T XML** | **OFF** | Flag off; dataset export only. XML enablement is post-beta (needs e2e-green + Object-Lock bucket + NRA XSD/values). |
| **OCR / extraction** | **Dev/native fallback — managed EU vendor NOT yet integrated** | `OCR_REAL=true`, `OCR_VENDOR_URL` unset → **born-digital parse** (pdf.js) for native PDFs + deterministic sample extraction for image/text-less files. **Every extraction is human-reviewed before posting** (AI proposes, never commits), so beta is safe without the vendor; vendor integration + accuracy eval is a **public-launch blocker**, tracked in the Risk Register and Exit Criteria. |
| **AI** | **Extraction + simple suggestions only** | No auto-posting, no chat, no CFO, no anomaly detection, no learning beyond per-counterparty memory (CLAUDE.md §10). AI runs under a **capability-limited identity** — it cannot post to the ledger, file, sign, or change permissions. Deterministic validators outrank AI. |

---

## Phase 2 — Beta Entry Criteria

**All of the following must be true before the first real beta user is invited.** Status is current as of 2026-06-08. ✅ = met · ⏳ = action required before first invite.

| # | Criterion | Status | Owner | Evidence / action |
|---|---|---|---|---|
| 1 | **CI green** — release-blocking lane passes (migrations apply, `migrate:validate` FORCE-RLS + rollback smoke, RLS isolation, ledger integrity, registration, **core accounting workflow e2e 14/14**, typecheck/lint/build, unit) | ✅ proven against real Postgres 16 | Eng lead | [BETA_READINESS_REPORT.md](../BETA_READINESS_REPORT.md) Phase 7 #2. (SAF-T *pipeline* e2e + gitleaks need GitHub Actions/Redis — **not on the beta critical path**; SAF-T XML is flag-off.) |
| 2 | **Restore drill signed** — real backup taken, checksummed, restored into a clean DB, all soundness checks green | ✅ done 2026-06-08 | Platform lead | [disaster-recovery.md](../runbooks/disaster-recovery.md) sign-off log; evidence in `docs/runbooks/evidence/`. |
| 3 | **Backup schedule enabled** — automated encrypted backups running on a cadence with freshness verification | ⏳ **action** | Platform/Ops on-call | Install `apps/api/scripts/pg-backup.sh` as a systemd timer / cron on the DB host (hourly), IAM + SSE-KMS per runbook. Confirm first scheduled artifact lands in S3 before invite. |
| 4 | **Monitoring active** — health + metrics + alarms + a daily audit-chain check covering the cohort | ✅ beta-sufficient | Platform/Ops on-call | `/health`(+`/live`,`/ready`), `/metrics` (prom-client), `GET /audit/verify`, RDS/Redis CloudWatch alarms + SNS ([observability.md](../runbooks/observability.md)). Scraper/dashboards/ALB+ECS alarms/correlation-id logging are **public-launch** items; the daily checklist (D5) covers the gaps **manually** during beta. |
| 5 | **Support owner assigned** — a named human owns beta support with documented response targets | ⏳ **action** | (assign name) | Name the beta support owner + backup, publish contact channel + hours, and the P1/P2 response targets from the Exit Criteria. |
| 6 | **Rollback plan documented** — app, migration, data, and storage rollback paths written and tested | ✅ done | Eng lead + DBA | [disaster-recovery.md](../runbooks/disaster-recovery.md) → *Emergency rollback* + *Migration rollback strategy* (expand-contract, forward-fix, PITR/restore). |

**Go decision:** all six green. The two ⏳ items (**install backup cron** + **assign a named support owner**) are the only gates between "Controlled Beta Ready" and "first user invited." Neither requires code.

---

## Related deliverables

1. **Controlled Beta Launch Plan** — this document.
2. **Beta Operations Runbook** — [`../runbooks/beta-operations.md`](../runbooks/beta-operations.md)
3. **Beta Risk Register** — [`BETA_RISK_REGISTER.md`](BETA_RISK_REGISTER.md)
4. **Beta Exit Criteria** — [`BETA_EXIT_CRITERIA.md`](BETA_EXIT_CRITERIA.md)
5. **First 30 Days Monitoring Plan** — [`../runbooks/beta-first-30-days-monitoring.md`](../runbooks/beta-first-30-days-monitoring.md)
