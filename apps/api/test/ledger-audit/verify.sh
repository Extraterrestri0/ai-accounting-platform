#!/usr/bin/env bash
# Ledger + audit proof against a real Postgres. Exit non-zero on any failure.
# Usage: PSQL_OWNER="psql -U app_owner -d acct" PSQL_APP="psql -U app_user -d acct" ./verify.sh
set -euo pipefail
A=11111111-1111-1111-1111-111111111111; CA=c1111111-1111-1111-1111-111111111111
B=22222222-2222-2222-2222-222222222222
CTXA="SELECT set_config('app.tenant_id','$A',false); SELECT set_config('app.company_id','$CA',false);"
ok(){ echo "  PASS: $1"; }; bad(){ echo "  FAIL: $1"; exit 1; }

echo "T1 balanced posting passes"
$PSQL_APP -q -v ON_ERROR_STOP=1 <<SQL >/dev/null && ok "balanced" || bad "balanced rejected"
$CTXA
BEGIN;
WITH cnt AS (INSERT INTO ledger_entry_counters(tenant_id,company_id,next_no) VALUES ('$A'::uuid,'$CA'::uuid,1)
  ON CONFLICT (tenant_id,company_id) DO UPDATE SET next_no=ledger_entry_counters.next_no+1 RETURNING next_no),
e AS (INSERT INTO journal_entries(tenant_id,company_id,entry_no,posting_date,description,created_by_actor_type,created_by_actor_id)
  SELECT '$A'::uuid,'$CA'::uuid,next_no,'2026-05-01','Sale','user','a1111111-1111-1111-1111-111111111111'::uuid FROM cnt RETURNING id)
INSERT INTO journal_lines(tenant_id,company_id,entry_id,line_no,account_id,direction,amount)
SELECT '$A'::uuid,'$CA'::uuid,e.id,1,'aa000001-0000-0000-0000-000000000001'::uuid,'debit',100.00 FROM e
UNION ALL SELECT '$A'::uuid,'$CA'::uuid,e.id,2,'aa000001-0000-0000-0000-000000000002'::uuid,'credit',100.00 FROM e;
COMMIT;
SQL

echo "T2 unbalanced posting fails"
$PSQL_APP -q -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 && bad "unbalanced committed" || ok "unbalanced rejected"
$CTXA
BEGIN;
WITH cnt AS (INSERT INTO ledger_entry_counters(tenant_id,company_id,next_no) VALUES ('$A'::uuid,'$CA'::uuid,1)
  ON CONFLICT (tenant_id,company_id) DO UPDATE SET next_no=ledger_entry_counters.next_no+1 RETURNING next_no),
e AS (INSERT INTO journal_entries(tenant_id,company_id,entry_no,posting_date,created_by_actor_type)
  SELECT '$A'::uuid,'$CA'::uuid,next_no,'2026-05-02','user' FROM cnt RETURNING id)
INSERT INTO journal_lines(tenant_id,company_id,entry_id,line_no,account_id,direction,amount)
SELECT '$A'::uuid,'$CA'::uuid,e.id,1,'aa000001-0000-0000-0000-000000000001'::uuid,'debit',100.00 FROM e
UNION ALL SELECT '$A'::uuid,'$CA'::uuid,e.id,2,'aa000001-0000-0000-0000-000000000002'::uuid,'credit',90.00 FROM e;
COMMIT;
SQL

echo "T3 update blocked"
$PSQL_APP -q -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 && bad "update allowed" || ok "update blocked"
$CTXA
UPDATE journal_entries SET description='x';
SQL

echo "T4 delete blocked"
$PSQL_APP -q -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 && bad "delete allowed" || ok "delete blocked"
$CTXA
DELETE FROM journal_lines;
SQL

echo "T5 audit chain validates"
C=$($PSQL_APP -tAq <<SQL
$CTXA
INSERT INTO audit_events(tenant_id,company_id,actor_type,action,entity_type,entity_id,after_snapshot)
VALUES ('$A'::uuid,'$CA'::uuid,'user','ledger.entry_posted','journal_entry',gen_random_uuid(),'{"a":1}');
SELECT app.verify_audit_chain('$A'::uuid);
SQL
)
[ "$(echo "$C"|tail -1)" = "t" ] && ok "audit chain valid" || bad "audit chain invalid"

echo "T6 tamper detected"
$PSQL_OWNER -q -c "ALTER TABLE audit_events DISABLE TRIGGER audit_events_immutable;" >/dev/null
TT=$($PSQL_OWNER -tAq -c "UPDATE audit_events SET after_snapshot='{\"a\":999}' WHERE tenant_id='$A'::uuid AND seq=1; SELECT app.verify_audit_chain('$A'::uuid);")
$PSQL_OWNER -q -c "ALTER TABLE audit_events ENABLE TRIGGER audit_events_immutable;" >/dev/null
[ "$(echo "$TT"|tail -1)" = "f" ] && ok "tamper detected" || bad "tamper undetected"

echo "T7 tenant isolation intact"
I=$($PSQL_APP -tAq <<SQL
$CTXA
SELECT (SELECT count(*) FROM journal_entries WHERE tenant_id='$B'::uuid)
     + (SELECT count(*) FROM audit_events    WHERE tenant_id='$B'::uuid);
SQL
)
[ "$(echo "$I"|tail -1)" = "0" ] && ok "isolation intact" || bad "cross-tenant leak"
echo "ALL LEDGER + AUDIT PROOFS PASSED"
