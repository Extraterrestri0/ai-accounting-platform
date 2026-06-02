# Immutable Ledger & Append-Only Audit — How It Works

## Guarantees (enforced at the database, not just the app)
1. **Double-entry**: a deferred `CONSTRAINT TRIGGER` (`assert_entry_balanced`) checks at COMMIT
   that each entry has >= 2 lines, `sum(debit) = sum(credit)`, and a non-zero total. Unbalanced
   ⇒ the whole transaction (including the audit event) rolls back.
2. **Immutable postings**: `deny_mutation()` triggers block `UPDATE`/`DELETE`/`TRUNCATE` on
   `journal_entries` and `journal_lines`; `app_user` also lacks UPDATE/DELETE privileges. The
   only correction is a **reversing entry**.
3. **Reversal**: a new entry with `reverses_entry_id = original.id` and lines whose direction is
   swapped (debit↔credit). A partial unique index (`uq_reversal_target`) allows **one reversal
   per original**.
4. **Append-only audit**: `audit_events` is insert-only (immutability triggers + no UPDATE/DELETE
   grant). A BEFORE INSERT trigger (`audit_chain_writer`) assigns `seq`, `prev_hash`, and
   `this_hash = sha256(prev_hash || '|' || canonical_payload)` under a per-tenant advisory lock,
   forming a linear, tamper-evident chain. `app.verify_audit_chain(tenant)` recomputes and returns
   FALSE on any broken link.

## Tenancy / RLS (inherited from Task 003)
Ledger tables are **company-scoped**: RLS `USING/WITH CHECK (tenant_id = app.current_tenant_id()
AND company_id = app.current_company_id())`. Audit is **tenant-scoped**. No active company ⇒
company predicate is NULL ⇒ zero rows (fail-closed). The app connects as `app_user` (NOBYPASSRLS).

## Atomic posting workflow (`LedgerService.postEntry`)
One `DatabaseContextService.run` transaction:
`allocate entry_no (counter UPSERT)` → `insert journal_entries` → `insert journal_lines` →
`IAuditService.append(scopedClient, …)` → COMMIT (deferred balance check fires here).
Because the audit append uses the SAME `ScopedClient`, posting and audit are atomic.

## Reversal workflow (`LedgerService.reverseEntry`)
Load original (RLS-scoped) → reject if already reversed → insert reversing entry + mirrored lines
→ append audit (`ledger.entry_reversed`, before/after) → COMMIT.

## Actor & snapshots
Audit records `actor_type` (`user|ai|system`) + `actor_id` from the request context, the action,
entity, `reason`, and `before/after` JSON snapshots, plus server-side `occurred_at`.

## Adding new ledger/financial tables (later tasks)
Reuse this pattern: tenant_id (+ company_id) NOT NULL, composite FKs, ENABLE+FORCE RLS with the
tenant (and company) policy, immutability triggers for any append-only/posted artifact, and write
the audit event in the SAME transaction as the state change.

## For Task 005 (Auth) and Task 010 (E2E)
- Auth only replaces how the principal/roles are resolved; the ledger/audit contracts
  (`ILedgerService`, `IAuditService`) and the context plumbing are unchanged.
- E2E composes `postEntry` after approval and reads via `getEntry/listEntries`; the audit chain
  and reversal flow are already in place. No redesign required.
