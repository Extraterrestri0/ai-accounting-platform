# Ledger + Audit Tests (release-blocking, accounting- & security-critical)

Proves, against a REAL Postgres with RLS active and the app as `app_user`:
- balanced posting commits; **unbalanced posting is rejected** (deferred double-entry check)
- ledger is **immutable**: UPDATE/DELETE blocked (trigger + no privilege)
- **reversal** mirrors the original (swap debit/credit); only one reversal per original
- **audit hash chain validates** and **detects tampering**
- **tenant isolation** still holds (no cross-tenant ledger/audit access)

## Run
1. Start Postgres; create `app_owner` (owner) + `app_user` (LOGIN NOBYPASSRLS).
2. Apply migrations 0001→0005 as owner.
3. Apply `seed.sql` as owner.
4. SQL/shell proof:  `PSQL_OWNER="psql -U app_owner -d acct" PSQL_APP="psql -U app_user -d acct" ./verify.sh`
   → expect `ALL LEDGER + AUDIT PROOFS PASSED`.
5. Jest:  `PGUSER=app_user pnpm --filter @app/api test:ledger` → green.

## Notes
- Posting + its audit event share ONE transaction; an unbalanced entry rolls back both.
- The immutability trigger blocks even the table owner; the tamper test temporarily
  DISABLEs that trigger (simulating raw DB access) to prove the hash chain still detects it.
- Verified passing on PostgreSQL 16 during development.
