/**
 * SAF-T stale-processing recovery suite (Phase 10). Real Postgres as app_user. Verifies
 * claimForProcessing's recovery semantics directly via controlled status + started_at:
 *   - a STALE 'processing' row (worker crashed after claiming) IS reclaimed;
 *   - a fresh/non-stale 'processing' row is NOT (single-flight preserved);
 *   - completed is never reprocessed; duplicate delivery is idempotent;
 *   - queued/failed retry still works.
 * Auto-skips without PG env. Requires: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE + MIGRATION_*.
 */
import { Pool } from 'pg';
import { TenantContextService } from '../../src/platform/tenant-context/tenant-context.service';
import { DatabaseContextService } from '../../src/platform/database/database-context.service';
import { SaftRepository } from '../../src/modules/saft/infrastructure/saft.repository';

// release-blocking DB suite — runs in CI (PG env set), skips locally, fails (not skips) when CI_REQUIRE_DB=1
const d = require('../helpers/db-e2e').dbDescribe as (name: string, fn: () => void) => void;

const TENANT = '7a7a0000-0000-0000-0000-00000000000a';
const COMPANY = '7a7a0000-0000-0000-0000-0000000000ca';
const USER = '7a7a0000-0000-0000-0000-0000000000aa';
const STALE_MS = 600_000; // 10 min threshold for the test

let appPool: Pool; let ownerPool: Pool; let ctx: TenantContextService; let db: DatabaseContextService;
const repo = new SaftRepository();
const base = () => ({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE });
const inCo = <T>(fn: () => Promise<T>): Promise<T> => ctx.run({ tenantId: TENANT, userId: USER, companyId: COMPANY }, fn);

/** Insert an export with an explicit status + started_at offset (minutes ago; null if undefined). */
async function seed(status: string, startedMinutesAgo?: number): Promise<string> {
  const startedAt = startedMinutesAgo === undefined ? 'NULL' : `now() - interval '${startedMinutesAgo} minutes'`;
  const r = await inCo(() => db.run((c) => c.query<{ id: string }>(
    `INSERT INTO saft_exports (tenant_id, company_id, year, month, status, started_at)
     VALUES ($1,$2,2026,5,$3, ${startedAt}) RETURNING id`, [TENANT, COMPANY, status])));
  return r.rows[0].id;
}
const statusOf = (id: string): Promise<string> =>
  inCo(() => db.run((c) => c.query<{ status: string }>('SELECT status FROM saft_exports WHERE id=$1', [id]))).then((r) => r.rows[0].status);
const claim = (id: string): Promise<boolean> => inCo(() => db.run((c) => repo.claimForProcessing(c, id, STALE_MS)));

d('SaftRepository.claimForProcessing — stale-processing recovery (Phase 10)', () => {
  beforeAll(async () => {
    ownerPool = new Pool({ ...base(), user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD });
    await ownerPool.query('ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY; ALTER TABLE companies NO FORCE ROW LEVEL SECURITY;');
    await ownerPool.query(`INSERT INTO tenants(id,name) VALUES ($1,'stale') ON CONFLICT (id) DO NOTHING`, [TENANT]);
    await ownerPool.query(`INSERT INTO companies(id,tenant_id,name) VALUES ($1,$2,'Co') ON CONFLICT (id) DO NOTHING`, [COMPANY, TENANT]);
    await ownerPool.query('ALTER TABLE tenants FORCE ROW LEVEL SECURITY; ALTER TABLE companies FORCE ROW LEVEL SECURITY;');
    appPool = new Pool({ ...base(), user: process.env.PGUSER, password: process.env.PGPASSWORD });
    ctx = new TenantContextService();
    db = new DatabaseContextService(appPool, ctx);
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query('ALTER TABLE saft_exports NO FORCE ROW LEVEL SECURITY');
      await ownerPool.query('DELETE FROM saft_exports WHERE tenant_id=$1', [TENANT]);
      await ownerPool.query('ALTER TABLE saft_exports FORCE ROW LEVEL SECURITY');
      await ownerPool.query('ALTER TABLE companies NO FORCE ROW LEVEL SECURITY; ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;');
      await ownerPool.query('DELETE FROM companies WHERE id=$1', [COMPANY]);
      await ownerPool.query('DELETE FROM tenants WHERE id=$1', [TENANT]);
      await ownerPool.query('ALTER TABLE companies FORCE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');
      await ownerPool.end();
    }
    if (appPool) await appPool.end();
  });

  it('reclaims a STALE processing export (worker crashed after claiming) and refreshes started_at', async () => {
    const id = await seed('processing', 20); // 20 min ago > 10 min threshold
    expect(await claim(id)).toBe(true);
    expect(await statusOf(id)).toBe('processing');
    const fresh = await inCo(() => db.run((c) => c.query<{ n: number }>("SELECT extract(epoch from (now()-started_at))::int AS n FROM saft_exports WHERE id=$1", [id])));
    expect(fresh.rows[0].n).toBeLessThan(60); // started_at was refreshed by the reclaim
  });

  it('does NOT reclaim a fresh/non-stale processing export (single-flight preserved)', async () => {
    const id = await seed('processing', 1); // 1 min ago < 10 min threshold
    expect(await claim(id)).toBe(false);
  });

  it('never reprocesses a COMPLETED export', async () => {
    const id = await seed('completed', 1);
    expect(await claim(id)).toBe(false);
    expect(await statusOf(id)).toBe('completed');
  });

  it('duplicate delivery after completion is an idempotent no-op', async () => {
    const id = await seed('completed', 30);
    expect(await claim(id)).toBe(false); // even "old" completed is not reclaimed
    expect(await claim(id)).toBe(false);
    expect(await statusOf(id)).toBe('completed');
  });

  it('still claims QUEUED and FAILED (existing retry behavior intact)', async () => {
    const q = await seed('queued');
    const f = await seed('failed', 30);
    expect(await claim(q)).toBe(true);
    expect(await claim(f)).toBe(true);
    expect(await statusOf(q)).toBe('processing');
    expect(await statusOf(f)).toBe('processing');
  });
});
