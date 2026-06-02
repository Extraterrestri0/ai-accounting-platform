-- RLS isolation proof. Run as the OWNER after migrations (psql, ON_ERROR_STOP=1).
-- Seeds two tenants, then acts as the RLS-subject app_user to assert isolation,
-- fail-closed behavior, forged-id rejection, and transaction-local scoping.
-- Any failed assertion RAISEs -> psql exits non-zero.

-- ---- seed as owner (briefly relax FORCE so the owner can bootstrap) ----
ALTER TABLE tenants             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE users               NO FORCE ROW LEVEL SECURITY;
ALTER TABLE companies           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE company_assignments NO FORCE ROW LEVEL SECURITY;

INSERT INTO tenants (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111','Tenant A'),
  ('22222222-2222-2222-2222-222222222222','Tenant B');
INSERT INTO users (id, tenant_id, email) VALUES
  ('a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','a@a.bg'),
  ('b2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','b@b.bg');
INSERT INTO companies (id, tenant_id, name) VALUES
  ('c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Company A1'),
  ('c2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Company B1');
INSERT INTO company_assignments (tenant_id, user_id, company_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','owner'),
  ('22222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','c2222222-2222-2222-2222-222222222222','owner');

ALTER TABLE tenants             FORCE ROW LEVEL SECURITY;
ALTER TABLE users               FORCE ROW LEVEL SECURITY;
ALTER TABLE companies           FORCE ROW LEVEL SECURITY;
ALTER TABLE company_assignments FORCE ROW LEVEL SECURITY;

-- ---- act as the RLS-subject application role ----
SET ROLE app_user;

-- TEST 0: transaction-local context (the production pattern) + auto-reset.
-- Inside the txn, SET LOCAL grants visibility; after COMMIT it is gone (fail-closed).
BEGIN;
  SELECT set_config('app.tenant_id','11111111-1111-1111-1111-111111111111', true); -- LOCAL
  DO $$ BEGIN
    IF (SELECT count(*) FROM companies) <> 1 THEN
      RAISE EXCEPTION 'FAIL T0a: local context did not grant tenant-A visibility';
    END IF;
  END $$;
COMMIT;
-- context did NOT leak past the transaction -> fail closed
DO $$ BEGIN
  IF (SELECT count(*) FROM companies) <> 0 THEN
    RAISE EXCEPTION 'FAIL T0b: transaction-local context leaked after COMMIT';
  END IF;
END $$;

-- For the remaining single-statement checks we use session scope (psql autocommits).
-- TEST 1: missing/empty context fails closed
SELECT set_config('app.tenant_id','', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM companies) <> 0 THEN RAISE EXCEPTION 'FAIL T1: not fail-closed'; END IF;
END $$;

-- TEST 2: tenant A sees only A
SELECT set_config('app.tenant_id','11111111-1111-1111-1111-111111111111', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM companies) <> 1 THEN RAISE EXCEPTION 'FAIL T2a'; END IF;
  IF (SELECT name FROM companies) <> 'Company A1' THEN RAISE EXCEPTION 'FAIL T2b'; END IF;
END $$;

-- TEST 3: A cannot READ B by id (forged target id)
DO $$ BEGIN
  IF (SELECT count(*) FROM companies WHERE id='c2222222-2222-2222-2222-222222222222') <> 0
  THEN RAISE EXCEPTION 'FAIL T3: A read B by id'; END IF;
END $$;

-- TEST 4: A cannot WRITE into tenant B (forged tenant_id rejected by WITH CHECK)
DO $$ BEGIN
  BEGIN
    INSERT INTO companies (tenant_id, name)
      VALUES ('22222222-2222-2222-2222-222222222222','Evil');
    RAISE EXCEPTION 'FAIL T4: A inserted into B';
  EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL; -- expected
  END;
END $$;

-- TEST 5: A cannot UPDATE B's row (0 rows affected)
DO $$ DECLARE n int; BEGIN
  UPDATE companies SET name='hacked' WHERE id='c2222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T5: A updated B (% rows)', n; END IF;
END $$;

-- TEST 6: assignment visibility is tenant-scoped
DO $$ BEGIN
  IF (SELECT count(*) FROM company_assignments) <> 1 THEN RAISE EXCEPTION 'FAIL T6: leak'; END IF;
END $$;

-- TEST 7: switching context to B shows only B
SELECT set_config('app.tenant_id','22222222-2222-2222-2222-222222222222', false);
DO $$ BEGIN
  IF (SELECT name FROM companies) <> 'Company B1' THEN RAISE EXCEPTION 'FAIL T7'; END IF;
END $$;

-- TEST 8: app_user is not superuser and cannot bypass RLS
RESET ROLE;
DO $$ BEGIN
  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname='app_user') THEN
    RAISE EXCEPTION 'FAIL T8a: app_user has BYPASSRLS'; END IF;
  IF (SELECT rolsuper FROM pg_roles WHERE rolname='app_user') THEN
    RAISE EXCEPTION 'FAIL T8b: app_user is superuser'; END IF;
END $$;

-- TEST 9: every tenancy table has RLS enabled
DO $$ DECLARE missing text; BEGIN
  SELECT string_agg(relname, ', ') INTO missing FROM pg_class
   WHERE relname IN ('tenants','users','organizations','companies','company_assignments')
     AND relrowsecurity = false;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL T9: RLS off on %', missing; END IF;
END $$;

\echo '===================================='
\echo '  ALL RLS ISOLATION CHECKS PASSED'
\echo '===================================='
