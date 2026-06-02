#!/usr/bin/env bash
# Auth DB-layer proof: pre-auth lookup works cross-tenant via SECURITY DEFINER,
# while app_user (NOBYPASSRLS) still cannot read other tenants directly.
set -euo pipefail
A=11111111-1111-1111-1111-111111111111
ok(){ echo "  PASS: $1"; }; bad(){ echo "  FAIL: $1"; exit 1; }

R=$($PSQL_APP -tAq <<SQL
SELECT set_config('app.tenant_id','$A',false);
SELECT tenant_id||'|'||password_hash||'|'||mfa_enabled FROM app.authenticate_lookup('b@b');
SQL
)
echo "$(echo "$R"|tail -1)" | grep -q '|HASH_B|true' && ok "pre-auth lookup finds cross-tenant user" || bad "lookup failed"

D=$($PSQL_APP -tAq <<SQL
SELECT set_config('app.tenant_id','$A',false);
SELECT count(*) FROM users WHERE email='b@b';
SQL
)
[ "$(echo "$D"|tail -1)" = "0" ] && ok "direct cross-tenant SELECT still blocked (RLS)" || bad "leak"
echo "AUTH DB-LAYER PROOFS PASSED"
