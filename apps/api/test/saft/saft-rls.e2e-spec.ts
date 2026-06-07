/**
 * SAF-T RLS isolation suite (RELEASE-BLOCKING). Runs against a real Postgres test DB
 * with migrations applied, connecting as the RLS-subject role (app_user) for the
 * assertions and as the owner only to seed/clean two tenants.
 *
 * Requires env: PGHOST, PGPORT, PGUSER=app_user, PGPASSWORD, PGDATABASE,
 *               MIGRATION_USER, MIGRATION_PASSWORD. Auto-skips when unset
 *               (same convention as rls-isolation / ledger-audit / registration).
 *
 * Proves for `saft_exports`:
 *   1) tenant A can read only its own export   2) tenant B cannot read A's export
 *   3) forged tenant_id INSERT is rejected (WITH CHECK)
 *   4) missing context fails closed   5) wrong company in-tenant hides the row
 *   6) RLS is ENABLED and FORCED on the table.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';
import { MissingTenantContextError } from '../../src/platform/tenant-context/errors';

const RUN = !!(process.env.PGHOST && process.env.PGUSER && process.env.MIGRATION_USER);
const d = RUN ? describe : describe.skip;

const TENANT_A = '5a5a0000-0000-0000-0000-00000000000a';
const COMPANY_A = '5a5a0000-0000-0000-0000-0000000000ca';
const USER_A = '5a5a0000-0000-0000-0000-0000000000aa';
const TENANT_B = '5b5b0000-0000-0000-0000-00000000000b';
const COMPANY_B = '5b5b0000-0000-0000-0000-0000000000cb';
const USER_B = '5b5b0000-0000-0000-0000-0000000000bb';
const OTHER_COMPANY = '5a5a0000-0000-0000-0000-0000000000cf'; // never assigned a row

let appPool: Pool;     // app_user (subject to RLS)
let ownerPool: Pool;   // owner (seed + teardown)
let ctx: TenantContextService;
let db: DatabaseContextService;

const base = () => ({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE });
const asCtx = <T>(tenantId: string, companyId: string, userId: string, fn: () => Promise<T>): Promise<T> =>
  ctx.run({ tenantId, userId, companyId }, fn);

d('SAF-T RLS isolation (saft_exports)', () => {
  beforeAll(async () => {
    ownerPool = new Pool({ ...base(), user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD });
    // Seed two tenants/companies as owner (briefly relax FORCE RLS), idempotently.
    await ownerPool.query('ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY; ALTER TABLE companies NO FORCE ROW LEVEL SECURITY;');
    await ownerPool.query(`INSERT INTO tenants(id,name) VALUES ($1,'saft-rls-A'),($2,'saft-rls-B') ON CONFLICT (id) DO NOTHING`, [TENANT_A, TENANT_B]);
    await ownerPool.query(`INSERT INTO companies(id,tenant_id,name) VALUES ($1,$2,'CoA'),($3,$4,'CoB') ON CONFLICT (id) DO NOTHING`, [COMPANY_A, TENANT_A, COMPANY_B, TENANT_B]);
    await ownerPool.query('ALTER TABLE tenants FORCE ROW LEVEL SECURITY; ALTER TABLE companies FORCE ROW LEVEL SECURITY;');

    appPool = new Pool({ ...base(), user: process.env.PGUSER, password: process.env.PGPASSWORD });
    ctx = new TenantContextService();
    db = new DatabaseContextService(appPool, ctx);

    // Seed one export for company A through the production write path (app_user + RLS).
    await asCtx(TENANT_A, COMPANY_A, USER_A, () =>
      db.run((c) => c.query(`INSERT INTO saft_exports (tenant_id, company_id, year, month, status) VALUES ($1,$2,2026,5,'generated')`, [TENANT_A, COMPANY_A])));
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query('ALTER TABLE saft_exports NO FORCE ROW LEVEL SECURITY');
      await ownerPool.query('DELETE FROM saft_exports WHERE tenant_id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('ALTER TABLE saft_exports FORCE ROW LEVEL SECURITY');
      await ownerPool.query('ALTER TABLE companies NO FORCE ROW LEVEL SECURITY; ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('DELETE FROM companies WHERE id = ANY($1)', [[COMPANY_A, COMPANY_B]]);
      await ownerPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('ALTER TABLE companies FORCE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');
      await ownerPool.end();
    }
    if (appPool) await appPool.end();
  });

  test('tenant A reads only its own export', async () => {
    const rows = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query('SELECT id, year, month FROM saft_exports')));
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ year: 2026, month: 5 });
  });

  test('tenant B cannot read tenant A export', async () => {
    const rows = await asCtx(TENANT_B, COMPANY_B, USER_B, () => db.run((c) => c.query('SELECT id FROM saft_exports')));
    expect(rows.rows).toHaveLength(0);
  });

  test('forged tenant_id INSERT is rejected by WITH CHECK', async () => {
    await expect(
      asCtx(TENANT_A, COMPANY_A, USER_A, () =>
        db.run((c) => c.query(`INSERT INTO saft_exports (tenant_id, company_id, year, month, status) VALUES ($1,$2,2026,6,'generated')`, [TENANT_B, COMPANY_B]))),
    ).rejects.toThrow();
  });

  test('missing tenant context fails closed (no query runs)', async () => {
    await expect(db.run((c) => c.query('SELECT 1 FROM saft_exports'))).rejects.toBeInstanceOf(MissingTenantContextError);
  });

  test('a different company within the tenant cannot see the export (company-scoped policy)', async () => {
    const rows = await asCtx(TENANT_A, OTHER_COMPANY, USER_A, () => db.run((c) => c.query('SELECT id FROM saft_exports')));
    expect(rows.rows).toHaveLength(0);
  });

  test('RLS is ENABLED and FORCED on saft_exports', async () => {
    const r = await asCtx(TENANT_A, COMPANY_A, USER_A, () =>
      db.run((c) => c.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'saft_exports'`)));
    expect(r.rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
  });
});
