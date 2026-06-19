-- Revert 0040: restore register_account / oauth_account without chart seeding and
-- drop the helper. (Backfilled accounts are data and are intentionally left intact.)

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
  RETURN QUERY SELECT v_user, v_tenant, v_company;
END$$;
ALTER FUNCTION app.register_account(text, text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION app.register_account(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.register_account(text, text, text) TO app_user;

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
  RETURN QUERY SELECT v_user, v_tenant, v_company, true;
END$$;
ALTER FUNCTION app.oauth_account(text, text) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION app.oauth_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.oauth_account(text, text) TO app_user;

DROP FUNCTION IF EXISTS app.seed_chart_of_accounts(uuid, uuid);
