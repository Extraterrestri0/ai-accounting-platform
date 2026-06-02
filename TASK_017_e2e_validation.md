# TASK 017 — End-to-End MVP Validation

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 017 · **Depends on:** 002–016 · **PR:** one scoped PR.
**Deliverable:** `task017-e2e-validation.zip` → unzip at repo root over Tasks 002–016. Adds the E2E harness, deterministic seed, the one-command validator, and the docker-validation script; refines the frontend API layer with a unit-testable mode selector.

> **Verified during build (real compiled services · live PostgreSQL 16):** the full financial workflow ran end-to-end through the real `LedgerService` / `VatService` / `InvoiceService` / `ReportsService` resolved from the actual NestJS DI container — **14/14 E2E checks passed**. The backend jest suite is **60/60** (11 suites, exercising the document/extraction/rules/review/posting services), `docker compose` config validates (7 services), and the frontend build proves it calls the real backend when configured.

## 1. Files created
- `apps/api/test/e2e/e2e-workflow.ts` — boots `NestFactory.createApplicationContext(AppModule)`, drives the real services via `JobContextRunner`, and asserts every required invariant.
- `apps/api/scripts/seed-e2e.sql` — deterministic demo data (tenant A + isolation tenant B, demo company Акме Демо ООД, chart of accounts, VAT code, customer).
- `apps/api/scripts/e2e.sh` — **the one command**: install → build → (re)create DB → migrate → seed → jest → E2E workflow (Docker-aware via `USE_DOCKER=1`).
- `infra/docker-validate.sh` — `docker compose config` + image build when Docker is present; structural YAML validation otherwise.

## 2. Files modified
- `apps/web/lib/api-layer.ts` — extracted a pure, testable `selectApiMode()` (real when `NEXT_PUBLIC_API_URL` is set and mock isn't forced); behavior unchanged.

## 3. E2E workflow proof
One run, real services, live PostgreSQL — the deterministic demo: an approved **purchase** posts Dr 602 200 / Dr 4531 40 / Cr 401 240; a **sales invoice** (1 × 300.00 @ 20%) is created and **issued** → gapless number `2026-0001`, PDF generated, posted Dr 411 360 / Cr 702 300 / Cr 4532 60, and the **sales VAT register** fed. Then VAT registers/return, then reports. The workflow steps map to the brief: tenant/company/accounts (seed) → post (10) → invoice create+issue+post (13–14) → VAT build+return (11–12) → reports (15) → dashboard (Task 015). Upload→OCR→extraction→suggestion→review (4–9) run through the real services in the **jest suite** invoked by the same script.

## 4. Test results
**E2E (ran, 14/14 PASS):**
- posted balanced purchase via real LedgerService · **unbalanced entry rejected** by the ledger
- invoice draft gross 360.00 · **issued with gapless number 2026-0001** · **posted to the ledger**
- **VAT summary output 60 / deductible 40 / payable 20** · VAT return payable 20.00
- **trial balance balances (600.00 = 600.00)** · P&L revenue 300 / expense 200 / net profit 100
- **issued invoice immutable** (UPDATE blocked) · **AI cannot approve** (review_actions rejects actor_type=ai)
- **AI cannot post** (every journal entry is human-authored) · **audit chain validates** · **RLS: tenant B sees 0** of tenant A

**Suite:** jest **60/60** across 11 suites (auth, masterdata, documents, extraction, rules, review, posting, vat, invoicing, reporting, health). Compose validated (db, redis, minio, migrate, api, worker, web). Frontend: building with `NEXT_PUBLIC_API_URL=https://api.acct-demo.test` puts that URL in the static bundle → **the frontend calls the real backend, not mock data**; the default build (mock fallback) stays green.

## 5. Screenshots
The navigable UI was rendered in Task 015 (dashboard, registers, invoice, reports). This task is workflow validation; its "screenshot" is the E2E console proof above (14/14) — the same numbers the UI shows (payable 20.00, net profit 100.00, invoice 2026-0001) computed by the real backend.

## 6. Bugs found
- **Period mismatch:** `InvoiceService.issueInvoice` posts at the current date, but the first draft of the E2E built VAT registers for a fixed month (April) — the June sale wouldn't appear, so VAT payable would compute as 0/refundable 40.
- **`PIPESTATUS` under `/bin/sh`:** a harness shell line used a bashism that errored under `sh` (cosmetic; the E2E process itself exited 0).

## 7. Bugs fixed
- The E2E now derives the period from `new Date()` and posts the purchase on the same date as the invoice, so VAT/registers/reports all see both entries (payable resolves to 20.00). Verified green.
- Shell proofs avoid `PIPESTATUS`; the validator script is `bash`-shebanged and `bash -n` clean. No product-code defects were found — the financial core behaved exactly as the per-task proofs predicted.

## 8. Known limitations
- **Front-half via jest, not the live HTTP path:** upload/OCR/extraction/review run through the real services in the jest suite (dev queue/storage adapters), not as live HTTP calls in the E2E harness; a Playwright browser flow against `docker compose up` is the natural next layer (needs a Docker host — unavailable in this sandbox).
- **No Docker daemon in-sandbox:** `e2e.sh`/`docker-validate.sh` are validated for syntax and run against the live PostgreSQL directly; `USE_DOCKER=1` and image builds must be exercised on a host with Docker.
- **Storage probe is the local adapter** in-process; S3/MinIO connectivity is validated by config, not a live call here.
- The E2E asserts "AI cannot post" structurally (every journal entry is human-authored; AI writes only suggestions; approvals are DB-restricted to humans) rather than by attempting an AI post path — there is no such code path by design.

## 9. Next recommended task
**Task 018 — Pilot Readiness.** With the full workflow proven on the real stack and a one-command validator in place, 018 can focus on pilot hardening: a Playwright browser E2E against the Docker stack, seed/onboarding for a real pilot company, observability/alerting, runbooks, and a go-live checklist.

---
**Acceptance met:** a developer runs one command — `apps/api/scripts/e2e.sh` (optionally `USE_DOCKER=1`) — to validate the full MVP workflow locally; the frontend uses the real backend when `NEXT_PUBLIC_API_URL` is set. All required proofs hold: RLS end-to-end, AI cannot post/approve, unbalanced entries rejected, audit chain validates, VAT payable correct, reports balance, issued invoices immutable.
*Commit: `test(e2e): full-workflow validation on real services + live Postgres; one-command validator`.*
