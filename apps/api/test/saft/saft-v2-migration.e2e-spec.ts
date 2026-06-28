/**
 * SAF-T v2 migration suite (RELEASE-BLOCKING). Verifies migration 0035 against a
 * real Postgres test DB as the RLS-subject role (app_user): the widened status
 * lifecycle, the column-scoped UPDATE grant (identity stays immutable), and the
 * new append-only, RLS-forced saft_export_artifacts table.
 *
 * Requires env: PGHOST, PGPORT, PGUSER=app_user, PGPASSWORD, PGDATABASE,
 *               MIGRATION_USER, MIGRATION_PASSWORD. Auto-skips when unset.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';

// release-blocking DB suite — runs in CI (PG env set), skips locally, fails (not skips) when CI_REQUIRE_DB=1
const d = require('../helpers/db-e2e').dbDescribe as (name: string, fn: () => void) => void;

const TENANT_A = '5d5d0000-0000-0000-0000-00000000000a';
const COMPANY_A = '5d5d0000-0000-0000-0000-0000000000ca';
const USER_A = '5d5d0000-0000-0000-0000-0000000000aa';
const TENANT_B = '5e5e0000-0000-0000-0000-00000000000b';
const COMPANY_B = '5e5e0000-0000-0000-0000-0000000000cb';
const USER_B = '5e5e0000-0000-0000-0000-0000000000bb';

let appPool: Pool;
let ownerPool: Pool;
let ctx: TenantContextService;
let db: DatabaseContextService;

const base = () => ({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE });
const asCtx = <T>(t: string, c: string, u: string, fn: () => Promise<T>): Promise<T> => ctx.run({ tenantId: t, userId: u, companyId: c }, fn);

async function newExport(tenant: string, company: string, user: string, status: string): Promise<string> {
  const r = await asCtx(tenant, company, user, () =>
    db.run((c) => c.query<{ id: string }>(
      `INSERT INTO saft_exports (tenant_id, company_id, year, month, status, requested_by, requested_at)
       VALUES ($1,$2,2026,5,$3,$4,now()) RETURNING id`, [tenant, company, status, user])));
  return r.rows[0].id;
}

d('SAF-T v2 migration 0035 (lifecycle + artifacts)', () => {
  beforeAll(async () => {
    ownerPool = new Pool({ ...base(), user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD });
    await ownerPool.query('ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY; ALTER TABLE companies NO FORCE ROW LEVEL SECURITY;');
    await ownerPool.query(`INSERT INTO tenants(id,name) VALUES ($1,'saft-v2-A'),($2,'saft-v2-B') ON CONFLICT (id) DO NOTHING`, [TENANT_A, TENANT_B]);
    await ownerPool.query(`INSERT INTO companies(id,tenant_id,name) VALUES ($1,$2,'CoA'),($3,$4,'CoB') ON CONFLICT (id) DO NOTHING`, [COMPANY_A, TENANT_A, COMPANY_B, TENANT_B]);
    await ownerPool.query('ALTER TABLE tenants FORCE ROW LEVEL SECURITY; ALTER TABLE companies FORCE ROW LEVEL SECURITY;');

    appPool = new Pool({ ...base(), user: process.env.PGUSER, password: process.env.PGPASSWORD });
    ctx = new TenantContextService();
    db = new DatabaseContextService(appPool, ctx);
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query('ALTER TABLE saft_export_artifacts NO FORCE ROW LEVEL SECURITY; ALTER TABLE saft_exports NO FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('DELETE FROM saft_export_artifacts WHERE tenant_id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('DELETE FROM saft_exports WHERE tenant_id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('ALTER TABLE saft_export_artifacts FORCE ROW LEVEL SECURITY; ALTER TABLE saft_exports FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('ALTER TABLE companies NO FORCE ROW LEVEL SECURITY; ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('DELETE FROM companies WHERE id = ANY($1)', [[COMPANY_A, COMPANY_B]]);
      await ownerPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[TENANT_A, TENANT_B]]);
      await ownerPool.query('ALTER TABLE companies FORCE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');
      await ownerPool.end();
    }
    if (appPool) await appPool.end();
  });

  describe('status lifecycle', () => {
    it('accepts the new v2 statuses and advances queued -> processing -> completed', async () => {
      const id = await newExport(TENANT_A, COMPANY_A, USER_A, 'queued');
      await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`UPDATE saft_exports SET status='processing', started_at=now() WHERE id=$1`, [id])));
      const upd = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`UPDATE saft_exports SET status='completed', completed_at=now(), xsd_valid=null WHERE id=$1`, [id])));
      expect(upd.rowCount).toBe(1);
      const row = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`SELECT status FROM saft_exports WHERE id=$1`, [id])));
      expect(row.rows[0].status).toBe('completed');
    });

    it('still accepts the v1 statuses (backward compatible)', async () => {
      await expect(newExport(TENANT_A, COMPANY_A, USER_A, 'generated')).resolves.toMatch(/^[0-9a-f-]{36}$/);
      await expect(newExport(TENANT_A, COMPANY_A, USER_A, 'failed')).resolves.toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects an unknown status (CHECK constraint)', async () => {
      await expect(newExport(TENANT_A, COMPANY_A, USER_A, 'bogus')).rejects.toThrow();
    });
  });

  describe('column-scoped UPDATE grant (identity immutable)', () => {
    it('app_user cannot UPDATE tenant_id (no column privilege)', async () => {
      const id = await newExport(TENANT_A, COMPANY_A, USER_A, 'queued');
      await expect(
        asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`UPDATE saft_exports SET tenant_id = tenant_id WHERE id=$1`, [id]))),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  describe('saft_export_artifacts', () => {
    it('is RLS ENABLED and FORCED', async () => {
      const r = await asCtx(TENANT_A, COMPANY_A, USER_A, () =>
        db.run((c) => c.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='saft_export_artifacts'`)));
      expect(r.rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
    });

    it('stores an artifact for an export and reads it back in the owning company', async () => {
      const exportId = await newExport(TENANT_A, COMPANY_A, USER_A, 'completed');
      await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(
        `INSERT INTO saft_export_artifacts (tenant_id, company_id, export_id, kind, storage_key, content_type, size_bytes, sha256)
         VALUES ($1,$2,$3,'xml',$4,'application/xml',123,'abc')`, [TENANT_A, COMPANY_A, exportId, `saft/${COMPANY_A}/${exportId}.xml`])));
      const rows = await asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(`SELECT kind, content_type FROM saft_export_artifacts WHERE export_id=$1`, [exportId])));
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]).toMatchObject({ kind: 'xml', content_type: 'application/xml' });
    });

    it('tenant B cannot read tenant A artifacts', async () => {
      const rows = await asCtx(TENANT_B, COMPANY_B, USER_B, () => db.run((c) => c.query(`SELECT id FROM saft_export_artifacts`)));
      expect(rows.rows).toHaveLength(0);
    });

    it('rejects a forged tenant_id artifact INSERT (WITH CHECK)', async () => {
      const exportId = await newExport(TENANT_A, COMPANY_A, USER_A, 'completed');
      await expect(
        asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(
          `INSERT INTO saft_export_artifacts (tenant_id, company_id, export_id, kind, storage_key, content_type)
           VALUES ($1,$2,$3,'xml','k','application/xml')`, [TENANT_B, COMPANY_B, exportId]))),
      ).rejects.toThrow();
    });

    it('rejects an artifact for a non-existent export (FK)', async () => {
      await expect(
        asCtx(TENANT_A, COMPANY_A, USER_A, () => db.run((c) => c.query(
          `INSERT INTO saft_export_artifacts (tenant_id, company_id, export_id, kind, storage_key, content_type)
           VALUES ($1,$2,$3,'xml','k','application/xml')`, [TENANT_A, COMPANY_A, '00000000-0000-0000-0000-000000000000']))),
      ).rejects.toThrow();
    });
  });
});
