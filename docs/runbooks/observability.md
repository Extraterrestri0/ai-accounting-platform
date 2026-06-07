# Observability Runbook

## Logs
- **Wired:** SAF-T pipeline emits **PII-free, whitelist-based structured logs** (`platform/observability/structured-log.ts`) — only operational fields (ids, counts, durations, error class), never customer names/amounts/tax-ids/XML/URLs.
- **Gap (High):** the rest of the platform uses NestJS `Logger` (not guaranteed JSON, **no correlation/request id**, no uniform PII redaction). Before public launch: add a correlation-id (request-id) propagation + a structured, redacted platform logger. *(Platform middleware, not a business feature; deferred to launch hardening to avoid touching the request pipeline during beta.)*

## Metrics
- **Wired:** `prom-client` registry at **`GET /metrics`** (process + SAF-T counters/histograms/queue gauges: `saft_export_*`, `saft_queue_depth`, `saft_failed_jobs`, `saft_stuck_*`, `saft_workers_connected`). `GET /health`, `/health/live`, `/health/ready` expose DB/storage/queue component health.
- **Gap (High):** nothing **scrapes** `/metrics` yet (no managed-Prometheus / CloudWatch agent), and there are **no core-loop SLO metrics** (posting latency, extraction throughput, invoice issuance, auth-failure rate). Wire a scraper + dashboards before public launch.

## Alerts
- **Wired (this program):** `infra/terraform/monitoring.tf` — encrypted SNS topic + CloudWatch alarms for **RDS** (CPU, free storage, connections) and **Redis** (engine CPU). Subscribe ops via `alarm_email`.
- **Remaining to wire (High, before public launch):**
  - **ALB:** `HTTPCode_Target_5XX_Count`, `TargetResponseTime` (needs ALB resource ref from `alb.tf`).
  - **ECS:** service CPU/memory + running-task-count < desired.
  - **App/queue (from `/metrics`):** `saft_queue_depth` backlog, `saft_failed_jobs` (DLQ) > 0, `saft_stuck_processing_exports` > 0, `saft_workers_connected` == 0, and a **scheduled audit-chain verification** failure (`GET /audit/verify`) → page.
  - **Health:** `/health` degraded/down synthetic check.

## Tracing
- **Gap (Medium):** no distributed tracing. Add OpenTelemetry spans (HTTP → service → DB/queue) before public launch; not required for beta.

## Beta posture
For beta: `/health` + `/metrics` + RDS/Redis alarms + the existing SAF-T structured logs are sufficient to operate a small cohort. Correlation-id logging, a metrics scraper/dashboards, ALB/ECS/app alarms, scheduled audit-verify, and tracing are **public-launch** items.
