/**
 * SAF-T repository integration suite (RELEASE-BLOCKING). Exercises the REAL SQL in
 * SaftRepository against a live Postgres test DB as the RLS-subject role (app_user).
 * This is the code unit tests cannot cover (the repo is mocked there): it verifies the
 * append-only export round-trip (incl. jsonb) AND that every SELECT's columns actually
 * exist in the migrated schema.
 *
 * Requires env: PGHOST, PGPORT, PGUSER=app_user, PGPASSWORD, PGDATABASE,
 *               MIGRATION_USER, MIGRATION_PASSWORD. Auto-skips when unset.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';
import { SaftRepository } from '../../src/modules/saft/infrastructure/saft.repository';

// release-blocking DB suite — runs in CI (PG env set), skips locally, fails (not skips) when CI_REQUIRE_DB=1
const d = require('../helpers/db-e2e').dbDescribe as (name: string, fn: () => void) => void;

const TENANT = '5c5c0000-0000-0000-0000-00000000000c';
const COMPANY = '5c5c0000-0000-0000-0000-0000000000cc';
const USER = '5c5c0000-0000-0000-0000-0000000000cd';

let appPool: Pool;
let ownerPool: Pool;
let ctx: TenantContextService;
let db: DatabaseContextService;
const repo = new SaftRepository();

const base = () => ({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE });
const inCompany = <T>(fn: () => Promise<T>): Promise<T> => ctx.run({ tenantId: TENANT, userId: USER, companyId: COMPANY }, fn);

d('SaftRepository (integration · real DB)', () => {
  beforeAll(async () => {
    ownerPool = new Pool({ ...base(), user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD });
    await ownerPool.query('ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY; ALTER TABLE companies NO FORCE ROW LEVEL SECURITY;');
    await ownerPool.query(`INSERT INTO tenants(id,name) VALUES ($1,'saft-repo') ON CONFLICT (id) DO NOTHING`, [TENANT]);
    await ownerPool.query(`INSERT INTO companies(id,tenant_id,name) VALUES ($1,$2,'Repo Co') ON CONFLICT (id) DO NOTHING`, [COMPANY, TENANT]);
    await ownerPool.query('ALTER TABLE tenants FORCE ROW LEVEL SECURITY; ALTER TABLE companies FORCE ROW LEVEL SECURITY;');

    appPool = new Pool({ ...base(), user: process.env.PGUSER, password: process.env.PGPASSWORD });
    ctx = new TenantContextService();
    db = new DatabaseContextService(appPool, ctx);
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query('ALTER TABLE saft_exports NO FORCE ROW LEVEL SECURITY');
      await ownerPool.query('DELETE FROM saft_exports WHERE tenant_id = $1', [TENANT]);
      await ownerPool.query('ALTER TABLE saft_exports FORCE ROW LEVEL SECURITY');
      await ownerPool.query('ALTER TABLE companies NO FORCE ROW LEVEL SECURITY; ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('DELETE FROM companies WHERE id = $1', [COMPANY]);
      await ownerPool.query('DELETE FROM tenants WHERE id = $1', [TENANT]);
      await ownerPool.query('ALTER TABLE companies FORCE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');
      await ownerPool.end();
    }
    if (appPool) await appPool.end();
  });

  it('persists and reads back an export (append-only + jsonb round-trip)', async () => {
    const summary = { ok: true, errors: [], warnings: [], info: [], counts: { errors: 0, warnings: 0, info: 0 } };
    const dataset = { header: { companyName: 'Repo Co' }, counts: { glEntries: 0 } };
    const id = await inCompany(() => db.run((c) => repo.insertExport(c, TENANT, COMPANY, {
      year: 2026, month: 5, status: 'generated', generatedBy: undefined, datasetJson: dataset, validationSummary: summary as any,
    })));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const rec = await inCompany(() => db.run((c) => repo.getExport(c, id)));
    expect(rec).toMatchObject({ id, year: 2026, month: 5, status: 'generated' });
    expect(rec!.validationSummary).toMatchObject({ ok: true });

    const list = await inCompany(() => db.run((c) => repo.listExports(c, COMPANY, 50, 0)));
    expect(list.some((r) => r.id === id)).toBe(true);

    const ds = await inCompany(() => db.run((c) => repo.getExportDataset(c, id))) as any;
    expect(ds).toMatchObject({ header: { companyName: 'Repo Co' } });
  });

  it('getExport returns null for an unknown id (RLS/empty result)', async () => {
    const rec = await inCompany(() => db.run((c) => repo.getExport(c, '00000000-0000-0000-0000-000000000000')));
    expect(rec).toBeNull();
  });

  it('companyInfo joins companies + company_settings with valid columns', async () => {
    const info = await inCompany(() => db.run((c) => repo.companyInfo(c, COMPANY)));
    expect(info.name).toBe('Repo Co');
    expect(typeof info.currency).toBe('string');
  });

  // Each of these proves the SELECT's columns exist in the real schema (empty company → []).
  it('master-file reads return [] for an empty company without SQL errors', async () => {
    await inCompany(async () => {
      expect(await db.run((c) => repo.customers(c, COMPANY))).toEqual([]);
      expect(await db.run((c) => repo.suppliers(c, COMPANY))).toEqual([]);
      expect(await db.run((c) => repo.products(c, COMPANY))).toEqual([]);
      expect(await db.run((c) => repo.accounts(c, COMPANY))).toEqual([]);
      expect(await db.run((c) => repo.taxCodes(c, COMPANY))).toEqual([]);
    });
  });

  it('period reads (gl/sales/payments) return [] for an empty period without SQL errors', async () => {
    await inCompany(async () => {
      expect(await db.run((c) => repo.glEntries(c, COMPANY, '2026-05-01', '2026-05-31'))).toEqual([]);
      expect(await db.run((c) => repo.salesInvoices(c, COMPANY, '2026-05-01', '2026-05-31'))).toEqual([]);
      expect(await db.run((c) => repo.payments(c, COMPANY, '2026-05-01', '2026-05-31'))).toEqual([]);
    });
  });
});
