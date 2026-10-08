/**
 * Registration provisioning (DB-backed, RELEASE-RELEVANT).
 *
 * Proves self-service signup creates the full membership graph — tenant + user +
 * tenant-level membership + company + company assignment — and, as the regression
 * for the 0021 ownership fix, that it works when invoked exactly the way the API
 * does it: as the non-bypass `app_user` role, inside a transaction with NO tenant
 * context (the `runWithoutTenant` path). If the `register_account` SECURITY DEFINER
 * function is owned by a non-BYPASSRLS role, the first INSERT trips FORCE RLS and
 * registration fails with "new row violates row-level security policy" — so this
 * suite would go red.
 *
 * Requires a real Postgres test DB with migrations applied:
 *   app role:   PGUSER (=app_user) / PGPASSWORD
 *   owner role: MIGRATION_USER / MIGRATION_PASSWORD (for inspection + cleanup)
 * Skips automatically when PG env is absent (e.g. unit-only CI lanes).
 */
import { Pool } from 'pg';

const HAS_DB = !!process.env.PGHOST && !!process.env.PGUSER && !!process.env.MIGRATION_USER;
const suite = HAS_DB ? describe : describe.skip;

suite('self-service registration provisions membership', () => {
  let app: Pool;   // runtime role — subject to RLS (app_user)
  let owner: Pool; // migration/superuser role — for inspection + teardown
  const email = `reg-e2e-${Date.now()}@example.com`;
  let tenantId: string | undefined;

  beforeAll(() => {
    const base = { host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE };
    app = new Pool({ ...base, user: process.env.PGUSER, password: process.env.PGPASSWORD });
    owner = new Pool({ ...base, user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD });
  });

  afterAll(async () => {
    // Teardown via the owner connection (RLS-free), FK-safe order.
    if (tenantId) {
      for (const t of ['auth_sessions', 'company_assignments', 'memberships', 'companies', 'users']) {
        await owner.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [tenantId]);
      }
      await owner.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    }
    await Promise.all([app.end(), owner.end()]);
  });

  test('app_user + no tenant context: creates tenant, user, membership, company, assignment', async () => {
    // Faithfully reproduce DatabaseContextService.runWithoutTenant: a transaction
    // with the tenant GUC explicitly blanked, then EXECUTE the signup function.
    const c = await app.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.tenant_id', '', true)");
      await c.query("SELECT set_config('app.company_id', '', true)");
      const r = await c.query(
        'SELECT user_id, tenant_id, company_id FROM app.register_account($1,$2,$3)',
        [email, '$argon2id$v=19$m=65536,t=3,p=4$fake$hash', 'Регистрация ООД'],
      );
      await c.query('COMMIT');
      expect(r.rows).toHaveLength(1);
      tenantId = r.rows[0].tenant_id;
      expect(r.rows[0].user_id).toBeTruthy();
      expect(r.rows[0].company_id).toBeTruthy();
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }

    // Inspect the provisioned graph via the owner connection.
    const m = await owner.query(
      `SELECT role, status FROM memberships WHERE tenant_id = $1`, [tenantId]);
    expect(m.rows).toEqual([{ role: 'tenant_admin', status: 'active' }]);

    const a = await owner.query(
      `SELECT role, status FROM company_assignments WHERE tenant_id = $1`, [tenantId]);
    expect(a.rows).toEqual([{ role: 'owner', status: 'active' }]);

    // The assignment must point at the company that was created for this tenant.
    const linked = await owner.query(
      `SELECT 1 FROM company_assignments a
         JOIN companies c ON c.id = a.company_id AND c.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1`, [tenantId]);
    expect(linked.rowCount).toBe(1);
  });

  test('signup SECURITY DEFINER functions are owned by a least-privilege BYPASSRLS role (not a superuser)', async () => {
    // Regression for 0021: register_account / oauth_account must run as the
    // dedicated auth_lookup role — BYPASSRLS (so signup inserts are not blocked
    // by FORCE RLS) but NOT a cluster superuser.
    const r = await owner.query(
      `SELECT p.proname, r.rolname AS owner, r.rolbypassrls, r.rolsuper
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_roles r     ON r.oid = p.proowner
        WHERE n.nspname = 'app' AND p.proname IN ('register_account','oauth_account')
        ORDER BY p.proname`);
    expect(r.rows).toHaveLength(2);
    for (const row of r.rows) {
      expect(row.rolbypassrls).toBe(true);
      expect(row.rolsuper).toBe(false);
    }
  });
});
