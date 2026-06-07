/**
 * SAF-T data-quality migration suite (Phase 8 / 0036). Real Postgres as app_user.
 * Verifies the scaffolding: saft_standard_accounts (RLS-forced, isolated) and the additive
 * uom_code / payment_method columns. Auto-skips without PG env.
 *
 * Requires: PGHOST, PGPORT, PGUSER=app_user, PGPASSWORD, PGDATABASE, MIGRATION_USER, MIGRATION_PASSWORD.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';

// release-blocking DB suite — runs in CI (PG env set), skips locally, fails (not skips) when CI_REQUIRE_DB=1
const d = require('../helpers/db-e2e').dbDescribe as (name: string, fn: () => void) => void;

const TENANT_A = '5f5f0000-0000-0000-0000-00000000000a';
const COMPANY_A = '5f5f0000-0000-0000-0000-0000000000ca';
const USER_A = '5f5f0000-0000-0000-0000-0000000000aa';
const TENANT_B = '6f6f0000-0000-0000-0000-00000000000b';
const COMPANY_B = '6f6f0000-0000-0000-0000-0000000000cb';
const USER_B = '6f6f0000-0000-0000-0000-0000000000bb';

let appPool: Pool; let ownerPool: Pool; let ctx: TenantContextService; let db: DatabaseContextService;
const base = () => ({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE });
const asCtx = <T>(t: string, c: string, u: string, fn: () => Promise<T>): Promise<T> => ctx.run({ tenantId: t, userId: u, companyId: c }, fn);

d('SAF-T data-quality migration 0036', () => {
  beforeAll(async () => {
    ownerPool = new Pool({ ...base(), user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD });
    await ownerPool.query('ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY; ALTER TABLE companies NO FORCE ROW LEVEL SECURITY;');
    await ownerPool.query(`INSERT INTO tenants(id,name) VALUES ($1,'dq-A'),($2,'dq-B') ON CONFLICT (id) DO NOTHING`, [TENANT_A, TENANT_B]);
    await ownerPool.query(`INSERT INTO companies(id,tenant_id,name) VALUES ($1,$2,'CoA'),($3,$4,'CoB') ON CONFLICT (id) DO NOTHING`, [COMPANY_A, TENANT_A, COMPANY_B, TENANT_B]);
    await ownerPool.query('ALTER TABLE tenants FORCE ROW LEVEL SECURITY; ALTER TABLE companies FORCE ROW LEVEL SECURITY;');
    appPool = new Pool({ ...base(), user: process.env.PGUSER, password: process.env.PGPASSWORD });
    ctx = new TenantContextService();
    db = new DatabaseContextService(appPool, ctx);
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query('ALTER TABLE saft_standard_accounts NO FORCE ROW LEVEL SECURITY');
      await ownerPool.query('DELETE FROM saft_standard_accounts WHERE tenant_id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('ALTER TABLE saft_standard_accounts FORCE ROW LEVEL SECURITY');
      await ownerPool.query('ALTER TABLE companies NO FORCE ROW LEVEL SECURITY; ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('DELETE FROM companies WHERE id = ANY($1)', [[COMPANY_A, COMPANY_B]]);
      await ownerPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('ALTER TABLE companies FORCE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');
      await ownerPool.end();
    }
    if (appPool) await appPool.end();
  });

  it('saft_standard_accounts is RLS ENABLED + FORCED', async () => {
    const r = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='saft_standard_accounts'`)));
    expect(r.rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
  });

  it('standard-account mapping is company-isolated', async () => {
    await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(
      `INSERT INTO saft_standard_accounts (tenant_id, company_id, account_code, standard_account_code) VALUES ($1,$2,'602','STD-PLACEHOLDER')`, [TENANT_A, COMPANY_A])));
    const own = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`SELECT account_code FROM saft_standard_accounts`)));
    expect(own.rows).toHaveLength(1);
    const other = await asCtx(TENANT_B, COMPANY_B, USER_B, () => db.run((c) => c.query(`SELECT account_code FROM saft_standard_accounts`)));
    expect(other.rows).toHaveLength(0);
  });

  it('the additive scaffolding columns exist (uom_code / payment_method)', async () => {
    const cols = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE (table_name='catalog_items' AND column_name='uom_code')
           OR (table_name='invoice_lines' AND column_name='uom_code')
           OR (table_name='payments' AND column_name='payment_method')`)));
    expect(cols.rows).toHaveLength(3);
  });
});
