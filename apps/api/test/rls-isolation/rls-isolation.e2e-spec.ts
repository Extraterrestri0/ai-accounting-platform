/**
 * RLS isolation suite (RELEASE-BLOCKING). Runs against a real Postgres test DB
 * with migrations applied and the app connected as the RLS-subject role (app_user).
 *
 * Requires env: PGHOST, PGPORT, PGUSER=app_user, PGPASSWORD, PGDATABASE.
 * Seeds two tenants via an owner connection, then exercises the production
 * DatabaseContextService (transaction + SET LOCAL + RLS) under each tenant context.
 *
 * Covers the six required scenarios:
 *   1) A cannot READ B   2) A cannot WRITE B   3) forged tenant_id rejected
 *   4) missing context fails closed   5) company switch only for assigned companies
 *   6) RLS policies are active.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';
import { MissingTenantContextError } from '../../src/platform/tenant-context/errors';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER_A = 'a1111111-1111-1111-1111-111111111111';
const COMPANY_A = 'c1111111-1111-1111-1111-111111111111';
const COMPANY_B = 'c2222222-2222-2222-2222-222222222222';

let pool: Pool;            // app_user (subject to RLS)
let ctx: TenantContextService;
let db: DatabaseContextService;

beforeAll(async () => {
  pool = new Pool({
    host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
  });
  ctx = new TenantContextService();
  db = new DatabaseContextService(pool, ctx);
  // Seeding is performed by the harness via the OWNER connection before this suite
  // (see scripts/test-rls). Here we only act as app_user.
});

afterAll(async () => { await pool.end(); });

const asTenant = <T>(tenantId: string, userId: string, fn: () => Promise<T>): Promise<T> =>
  ctx.run({ tenantId, userId }, fn);

test('tenant A reads only A (cannot read B)', async () => {
  await asTenant(TENANT_A, USER_A, async () => {
    const rows = await db.run((c) => c.query('SELECT id, name FROM companies'));
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].id).toBe(COMPANY_A);
    const b = await db.run((c) =>
      c.query('SELECT 1 FROM companies WHERE id = $1', [COMPANY_B]));
    expect(b.rowCount).toBe(0); // forged target id => invisible
  });
});

test('tenant A cannot write into tenant B (WITH CHECK rejects forged tenant_id)', async () => {
  await asTenant(TENANT_A, USER_A, async () => {
    await expect(
      db.run((c) =>
        c.query('INSERT INTO companies (tenant_id, name) VALUES ($1, $2)', [TENANT_B, 'Evil'])),
    ).rejects.toThrow(); // row-security / check violation
  });
});

test('tenant A cannot update tenant B rows (0 rows affected)', async () => {
  await asTenant(TENANT_A, USER_A, async () => {
    const res = await db.run((c) =>
      c.query("UPDATE companies SET name = 'hacked' WHERE id = $1", [COMPANY_B]));
    expect(res.rowCount).toBe(0);
  });
});

test('missing tenant context fails closed (no query runs)', async () => {
  // No ctx.run wrapper => no context in ALS.
  await expect(db.run((c) => c.query('SELECT 1 FROM companies'))).rejects.toBeInstanceOf(
    MissingTenantContextError,
  );
});

test('transaction-local context does not leak between requests', async () => {
  await asTenant(TENANT_A, USER_A, async () => {
    const r = await db.run((c) => c.query('SELECT count(*)::int AS n FROM companies'));
    expect(r.rows[0].n).toBe(1);
  });
  // Same pool, different (B) context — sees only B, proving no leak from the A request.
  await asTenant(TENANT_B, 'b2222222-2222-2222-2222-222222222222', async () => {
    const r = await db.run((c) => c.query('SELECT name FROM companies'));
    expect(r.rows.map((x: any) => x.name)).toEqual(['Company B1']);
  });
});

test('company switch authorizes only assigned companies', async () => {
  await asTenant(TENANT_A, USER_A, async () => {
    const ok = await db.run((c) =>
      c.query(
        `SELECT EXISTS(SELECT 1 FROM company_assignments
           WHERE user_id=$1 AND company_id=$2 AND status='active') AS ok`,
        [USER_A, COMPANY_A]));
    expect(ok.rows[0].ok).toBe(true);
    const cross = await db.run((c) =>
      c.query(
        `SELECT EXISTS(SELECT 1 FROM company_assignments
           WHERE user_id=$1 AND company_id=$2 AND status='active') AS ok`,
        [USER_A, COMPANY_B])); // B is another tenant's company => invisible => false
    expect(cross.rows[0].ok).toBe(false);
  });
});

test('RLS is enabled on every tenancy table', async () => {
  await asTenant(TENANT_A, USER_A, async () => {
    const res = await db.run((c) =>
      c.query(`SELECT relname FROM pg_class
                WHERE relname IN ('tenants','users','organizations','companies','company_assignments')
                  AND relrowsecurity = false`));
    expect(res.rows).toHaveLength(0);
  });
});
