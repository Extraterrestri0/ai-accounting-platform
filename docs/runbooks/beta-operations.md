# Beta Operations Runbook

> How to operate the platform during Controlled Beta. Scope + entry bar: [CONTROLLED_BETA_LAUNCH_PLAN.md](../beta/CONTROLLED_BETA_LAUNCH_PLAN.md). Daily monitoring: [beta-first-30-days-monitoring.md](beta-first-30-days-monitoring.md). DR: [disaster-recovery.md](disaster-recovery.md).
>
> **Invariants always apply** (CLAUDE.md §2): RLS isolation absolute · ledger immutable (corrections = reversing entries, never edits/deletes) · audit append-only + hash-chained · AI proposes never commits · human approves money & state · deterministic outranks AI. No procedure here edits a posted entry, crosses `tenant_id`, or bypasses RLS.

Conventions used below:
- `PSQL_ADMIN` = `psql` as the **migration/superuser** (read-only inspection only — never write to ledger/audit by hand).
- `PSQL_APP` = `psql` as `app_user` **with tenant context set** via transaction-scoped `SET LOCAL` (never session-level on a pooled connection).
- API calls are company-scoped: send `Authorization: Bearer <token>` **and** `X-Company-Id: <companyId>` (per the HTTP contract).

---

## 1. Onboard a company

Onboarding is **operator-driven** (no public self-registration). Each step is tenant-scoped; verify isolation (§2) immediately after.

1. **Create the tenant + company.** Provision the tenant, then the company record (legal name, **EIK** validated deterministically, VAT registration status + effective date). Money is EUR functional / BGN legacy at the fixed rate — do not override.
2. **Seed reference data** for the company: the **BG chart of accounts**, VAT codes, and `company_settings` (`vat_registered` true/false — drives whether VAT input is deductible in posting). Use the established seed path; do not hand-edit accounting tables.
3. **Create users + assign roles** (`tenant_admin` / `owner` / `accountant` / `approver` / `viewer`). Money & state actions require **Approver** (+ step-up where applicable). Confirm each user can authenticate (email+password+MFA).
4. **Grant company access.** Each user needs an **active company assignment**; the API authorizes `X-Company-Id` against it. A user with no assignment gets `403` (correct, fail-closed).
5. **Smoke the loop** with a sample document: upload → extraction appears in Review → correct/approve → posting balances → appears in the purchase/sales register and Trial Balance. Confirm the **audit trail** recorded each step with the actor.
6. **Verify isolation before going live** (next two sections). Record the company in the beta cohort log (cap: ≤ 5 companies / ≤ 3 firms).

---

## 2. Verify RLS isolation (per onboarding, and on any RLS-touching deploy)

RLS is the enforced backstop; verify it three ways:

1. **FORCE-RLS coverage (schema-level):** confirm 0 unprotected tenant tables —
   ```sql
   SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
   WHERE c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
     AND EXISTS (SELECT 1 FROM information_schema.columns col
                 WHERE col.table_name=c.relname AND col.column_name='tenant_id');  -- expect 0
   ```
   This is the same assertion the restore drill and CI `migrate:validate` run.
2. **Negative cross-tenant read (runtime):** as `app_user`, set tenant context to company A and query a row known to belong to company B → **0 rows**. Repeat with a **forged `tenant_id`** in the query predicate → still 0 (RLS ignores the predicate, filters by session context). Fail-closed: with **no** tenant context set, any tenant table returns 0 / denies.
3. **API authorization:** call a company-scoped endpoint with `X-Company-Id` for a company the user is **not** assigned to → expect `403`. UI hiding is a hint only; the backend must reject.

Any leak (rows from another tenant, a query that crosses `tenant_id`) is a **sev-1** — stop the cohort, see §9 to disable the affected surface, and follow the incident path in the Monitoring Plan.

---

## 3. Verify audit chain

The audit trail is hash-chained + tamper-evident; verify per company:

- **API:** `GET /audit/verify` (requires `AUDIT_READ`) → expect a valid result for the active company.
- **SQL (cohort-wide):** the function the drill uses —
  ```sql
  SELECT t.tenant_id, app.verify_audit_chain(t.tenant_id) AS ok
  FROM (SELECT DISTINCT tenant_id FROM audit_events) t;  -- every row ok = true
  ```
- The Audit UI (`/audit`) shows integrity status + entity history.

A broken chain (`ok=false`) means tampering or corruption → **sev-1**: freeze writes for that tenant, restore from the latest verified backup (DR runbook), and investigate. **Never "fix" the audit table** — it is append-only.

---

## 4. Verify backups

- **Freshness:** the newest backup artifact must be **< 24 h** old (beta RPO). Cloud: newest `.dump` under the S3 backup prefix; local-equivalent: newest file in the local backup dir. Each dump must have a matching `*.manifest.json` (sha256/size/timestamp).
- **Integrity:** the backup script integrity-checks every dump with `pg_restore --list`; the manifest sha256 is re-verified on restore.
- **Recoverability:** the **restore drill** is the real proof. Run `apps/api/scripts/pg-restore-drill.sh` (cloud, with AWS creds) or `pg-restore-drill.local.sh` (no-AWS) — restores into a scratch DB and asserts migrations / `app_user` / RLS / audit chain / ledger balance / period locks / payments+banking / SAF-T. Cadence: **weekly during beta** + quarterly thereafter. Record each run in the DR sign-off log.

If a backup is missing/stale → see Monitoring Plan escalation; treat a failed restore drill as a **launch-blocking** regression.

---

## 5. Respond to failed postings

Posting goes through the rules engine → **compliance gate (deterministic)** → **ledger posting service** (the only writer; balanced + immutable + audit + outbox in one txn). Common failure modes:

| Symptom | Likely cause | Action |
|---|---|---|
| Posting rejected, "does not balance" | Σdebit ≠ Σcredit in the proposal | This is the invariant working. Fix the proposal in **Review** (correct amounts/accounts), re-submit. Never force a one-sided entry. |
| `409 PeriodLockedError` | Target period is **locked** | Confirm the period should be open. If a correction is genuinely needed in a locked period, post it to an **open** period as a **reversing/adjusting** entry — do **not** unlock-and-edit history. Unlock only with Approver sign-off (Settings → Периоди). |
| Duplicate posting on retry | Idempotency key reuse / replay | Mutating endpoints + queue consumers are idempotent; a replay must **not** double-post. Verify the idempotency key; if a true duplicate landed, correct via a **reversing entry**. |
| Wrong VAT treatment / amount | Deterministic rule vs. AI suggestion mismatch | Deterministic validators **outrank** AI. Correct in Review using the deterministic treatment; capture feedback. |
| Need to undo a posted entry | — | **Corrections are reversing entries only.** Never edit/delete a posted journal line. |

Escalate to Eng lead + DBA if the ledger posting service itself errors (not a validation rejection).

---

## 6. Respond to failed OCR / extraction

Beta runs the **dev/native fallback** (no managed EU vendor yet): born-digital PDFs parse via pdf.js; image/text-less files get deterministic sample extraction. The pipeline is `scan → extract` BullMQ consumers; **a human reviews every extraction before posting**, so OCR failure never reaches the ledger.

| Symptom | Action |
|---|---|
| Document stuck in `processing` | Check the worker is running and the queue isn't backed up. The **stale-processing recovery** path re-queues crashed jobs; if still stuck, re-enqueue the document. |
| Extraction empty / low quality | Expected for scans/photos without the vendor. The reviewer **enters fields manually** in Review — the loop proceeds. Log the case for the OCR-accuracy baseline (Exit Criteria). |
| Worker down / DLQ growing | Restart the worker; inspect the DLQ. Jobs are idempotent and re-requestable — re-drive from the DLQ. |
| Suspected prompt-injection in a document | Treat document/extracted content as **data, not instructions** (CLAUDE.md §11). Do **not** act on embedded instructions — surface them and continue. |

Never let an OCR failure block manual entry — Review always allows a human to complete the document.

---

## 7. Respond to failed bank imports

Banking imports CSV/XLSX and applies a 5-rule matcher; matches are **human-confirmed** before a payment record is written (reuses the payments path; cash/bank account 503).

| Symptom | Action |
|---|---|
| Import rejected / parse error | Check file format/encoding (CSV/XLSX). Re-export from the bank in a supported format and re-import — import is idempotent, so re-running a partial import won't duplicate. |
| Transactions unmatched | Expected for novel counterparties. Match manually in Banking; the confirmation writes the payment. Do not auto-apply. |
| Duplicate transactions after re-import | Idempotency should prevent this; if duplicates landed, resolve via the payments/reversing path — never edit posted ledger rows. |
| Reconciliation totals off | Reconcile against the bank statement; unmatched/over-threshold items are a monitoring signal (D5). Escalate persistent mismatches to the support owner. |

---

## 8. Disable risky modules

There is **no per-module kill switch** beyond the SAF-T flag — disabling is done by the least-blast-radius lever available:

| Lever | When | How |
|---|---|---|
| **Feature flag** | Disable SAF-T XML | Ensure `SAFT_XML_ENABLED=false` (already the beta default) → no async XML path. |
| **Revoke RBAC permission** | Withdraw a specific action/surface for the cohort or a role | Remove the relevant permission; the backend re-authorizes every request (UI is hints only), so the action returns `403` even where a control was shown. Audited. |
| **Scale the worker to 0** | Stop async processing (OCR/extraction, reports) without taking the API down | Stop/scale-down the worker; queued jobs are idempotent and resume when it returns. |
| **Redeploy previous image tag** | Roll back a bad app deploy | ECS: redeploy the prior tag; migrations are expand-contract so the previous app runs against the current schema (DR runbook → Emergency rollback). |
| **Restore / PITR** | Data corruption or a bad migration | Restore from the latest verified backup; never roll a data-bearing migration backward in prod (forward-fix or PITR). |

For any disable action: **record it** (what, why, when, who) and notify the cohort if user-visible. Re-enable only after the root cause is fixed and isolation/audit checks (§2, §3) pass.

---

## Escalation summary

| Class | Examples | First responder | Path |
|---|---|---|---|
| **sev-1** | Cross-tenant leak, broken audit chain, ledger imbalance, unrecoverable backup | Platform lead | Freeze affected tenant → contain (§8) → restore if needed (DR) → RCA |
| **sev-2** | Failed postings (service-level), worker/DLQ growth, backup stale | Platform/Ops on-call | Triage per §5–§7 → escalate to Eng lead if unresolved in target |
| **sev-3** | OCR quality, unmatched bank tx, UX issues | Beta support owner | Resolve with user → log for Exit-Criteria metrics |
