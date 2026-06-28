-- =====================================================================
-- 0040 Auto-seed the Bulgarian chart of accounts (+ standard VAT code) for
-- every newly created company, so new companies can post immediately.
-- Before this, only the seeded demo company had accounts; a freshly registered
-- company hit "Unknown account code" (422) on the first posting.
--
-- One SECURITY DEFINER helper is the single source of truth, called from:
--   1) app.register_account  (email/password sign-up)
--   2) app.oauth_account     (Google sign-up — also provisions a company)
--   3) CompanyRepository.create (firm switcher / additional companies)
--
-- Tenant isolation (Inv. 1) is preserved: if the helper is invoked inside a
-- tenant-scoped request (app.tenant_id set), the target tenant MUST match it.
-- register/oauth run with no request context and seed the company they just made.
-- =====================================================================

CREATE OR REPLACE FUNCTION app.seed_chart_of_accounts(p_tenant uuid, p_company uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE v_ctx text := current_setting('app.tenant_id', true);
BEGIN
  -- Cross-tenant guard: only enforced when a real request tenant context exists.
  IF v_ctx IS NOT NULL AND v_ctx <> '' AND v_ctx <> p_tenant::text THEN
    RAISE EXCEPTION 'tenant_mismatch';
  END IF;

  -- Bulgarian national chart subset the core loop needs (purchase + sale + payment).
  INSERT INTO accounts (id, tenant_id, company_id, code, name, type, normal_balance) VALUES
    (gen_random_uuid(), p_tenant, p_company, '602',  'Външни услуги',                  'expense',   'debit'),
    (gen_random_uuid(), p_tenant, p_company, '4531', 'ДДС покупки (данъчен кредит)',   'asset',     'debit'),
    (gen_random_uuid(), p_tenant, p_company, '401',  'Доставчици',                     'liability', 'credit'),
    (gen_random_uuid(), p_tenant, p_company, '702',  'Приходи от продажби',            'revenue',   'credit'),
    (gen_random_uuid(), p_tenant, p_company, '4532', 'ДДС продажби',                   'liability', 'credit'),
    (gen_random_uuid(), p_tenant, p_company, '411',  'Клиенти',                        'asset',     'debit'),
    (gen_random_uuid(), p_tenant, p_company, '503',  'Разплащателна сметка',           'asset',     'debit')
  ON CONFLICT DO NOTHING;

  -- Standard 20% VAT code (input + output), so VAT classification works out of the box.
  INSERT INTO vat_codes (id, tenant_id, company_id, code, description, kind, rate, direction) VALUES
    (gen_random_uuid(), p_tenant, p_company, 'STD20', 'Стандартна ставка 20%', 'standard', 20, 'both')
  ON CONFLICT DO NOTHING;
END$$;
ALTER FUNCTION app.seed_chart_of_accounts(uuid, uuid) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION app.seed_chart_of_accounts(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.seed_chart_of_accounts(uuid, uuid) TO app_user;

-- ---- registration: seed the new company's chart in the same atomic block --------
CREATE OR REPLACE FUNCTION app.register_account(p_email text, p_password_hash text, p_company_name text)
RETURNS TABLE (user_id uuid, tenant_id uuid, company_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE v_tenant uuid; v_user uuid; v_company uuid;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(p_email)) THEN RAISE EXCEPTION 'email_taken'; END IF;
  INSERT INTO tenants(name) VALUES (coalesce(nullif(trim(p_company_name), ''), 'My Company')) RETURNING id INTO v_tenant;
  INSERT INTO users(tenant_id, email, status, password_hash, password_algo, mfa_enabled)
    VALUES (v_tenant, lower(p_email), 'active', p_password_hash, 'argon2id', false) RETURNING id INTO v_user;
  INSERT INTO memberships(tenant_id, user_id, role) VALUES (v_tenant, v_user, 'tenant_admin');
  INSERT INTO companies(tenant_id, name, base_currency, vat_status)
    VALUES (v_tenant, coalesce(nullif(trim(p_company_name), ''), 'My Company'), 'EUR', 'none') RETURNING id INTO v_company;
  INSERT INTO company_assignments(tenant_id, user_id, company_id, role) VALUES (v_tenant, v_user, v_company, 'owner');
  PERFORM app.seed_chart_of_accounts(v_tenant, v_company);
  RETURN QUERY SELECT v_user, v_tenant, v_company;
END$$;
ALTER FUNCTION app.register_account(text, text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION app.register_account(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.register_account(text, text, text) TO app_user;

-- ---- OAuth provisioning: seed the new company's chart too ------------------------
CREATE OR REPLACE FUNCTION app.oauth_account(p_email text, p_company_name text)
RETURNS TABLE (user_id uuid, tenant_id uuid, company_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app AS $$
DECLARE v_tenant uuid; v_user uuid; v_company uuid; v_existing record;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN RAISE EXCEPTION 'invalid_email'; END IF;
  SELECT u.id, u.tenant_id INTO v_existing FROM users u WHERE lower(u.email) = lower(p_email);
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.tenant_id, NULL::uuid, false;
    RETURN;
  END IF;
  INSERT INTO tenants(name) VALUES (coalesce(nullif(trim(p_company_name), ''), 'My Company')) RETURNING id INTO v_tenant;
  INSERT INTO users(tenant_id, email, status, password_hash, password_algo, mfa_enabled)
    VALUES (v_tenant, lower(p_email), 'active', NULL, 'argon2id', false) RETURNING id INTO v_user;
  INSERT INTO memberships(tenant_id, user_id, role) VALUES (v_tenant, v_user, 'tenant_admin');
  INSERT INTO companies(tenant_id, name, base_currency, vat_status)
    VALUES (v_tenant, coalesce(nullif(trim(p_company_name), ''), 'My Company'), 'EUR', 'none') RETURNING id INTO v_company;
  INSERT INTO company_assignments(tenant_id, user_id, company_id, role) VALUES (v_tenant, v_user, v_company, 'owner');
  PERFORM app.seed_chart_of_accounts(v_tenant, v_company);
  RETURN QUERY SELECT v_user, v_tenant, v_company, true;
END$$;
ALTER FUNCTION app.oauth_account(text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION app.oauth_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.oauth_account(text, text) TO app_user;

-- ---- backfill: seed any existing company that currently has no accounts ---------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.tenant_id, c.id FROM companies c
           WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.company_id = c.id)
  LOOP
    PERFORM app.seed_chart_of_accounts(r.tenant_id, r.id);
  END LOOP;
END$$;
