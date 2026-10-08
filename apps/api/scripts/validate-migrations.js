/* eslint-disable */
/**
 * Migration validation (Phase 2 of the Beta Readiness Program). Run AFTER `migrate.js` against a
 * freshly-migrated database. Verifies three invariants and exits non-zero on any failure:
 *
 *   1) APPLY-COMPLETENESS — every db/migrations/*.up.sql is recorded in schema_migrations.
 *   2) RLS COVERAGE       — every table with a `tenant_id` column has ROW LEVEL SECURITY
 *                           ENABLED *and* FORCED (the multi-tenant safety backstop).
 *   3) ROLLBACK SMOKE     — the latest migration's .down.sql + .up.sql both execute, inside a
 *                           transaction that is ROLLED BACK (no net change) — proving the down
 *                           script is valid without mutating the database.
 *
 * No schema is mutated. Connects as MIGRATION_USER (owner) so it can inspect/execute DDL.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dir = path.join(__dirname, '..', 'db', 'migrations');
const conn = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.MIGRATION_USER ?? process.env.PGUSER,
  password: process.env.MIGRATION_PASSWORD ?? process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
};

const fail = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { console.log(`  ✗ ${msg}`); fail.push(msg); };

async function main() {
  const ups = fs.readdirSync(dir).filter((f) => f.endsWith('.up.sql')).sort();
  const c = new Client(conn);
  await c.connect();

  // 1) apply-completeness
  const applied = new Set((await c.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));
  for (const f of ups) (applied.has(f) ? ok(`applied: ${f}`) : bad(`NOT applied: ${f}`));
  if (applied.size !== ups.length) bad(`schema_migrations has ${applied.size} rows; expected ${ups.length}`);

  // 2) RLS coverage — every tenant-scoped table must be ENABLE + FORCE RLS
  const rls = await c.query(`
    SELECT c.relname AS table, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relkind = 'r'
       AND EXISTS (SELECT 1 FROM information_schema.columns col
                    WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id')
     ORDER BY c.relname`);
  const unprotected = rls.rows.filter((r) => !r.enabled || !r.forced);
  if (unprotected.length === 0) ok(`RLS ENABLE+FORCE on all ${rls.rows.length} tenant-scoped tables`);
  else unprotected.forEach((r) => bad(`tenant table without FORCE RLS: ${r.table} (enabled=${r.enabled}, forced=${r.forced})`));

  // 3) rollback smoke for the latest migration (down + up), rolled back
  const latest = ups[ups.length - 1];
  const down = latest.replace('.up.sql', '.down.sql');
  const downPath = path.join(dir, down);
  if (!fs.existsSync(downPath)) {
    bad(`latest migration ${latest} has no ${down}`);
  } else {
    try {
      await c.query('BEGIN');
      await c.query(fs.readFileSync(downPath, 'utf8'));
      await c.query(fs.readFileSync(path.join(dir, latest), 'utf8'));
      await c.query('ROLLBACK');
      ok(`rollback smoke: ${down} + ${latest} both execute (rolled back, no net change)`);
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch {}
      bad(`rollback smoke failed for ${latest}: ${e.message}`);
    }
  }

  await c.end();
  console.log(fail.length === 0 ? '\n✅ migration validation passed' : `\n❌ migration validation FAILED (${fail.length})`);
  process.exit(fail.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
