/* Minimal forward migration runner. Applies db/migrations/NNNN_*.up.sql in order.
   Connects as the MIGRATION role (owner) — separate from the app_user runtime role. */
const fs = require('fs'); const path = require('path'); const { Client } = require('pg');
async function main() {
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const ups = fs.readdirSync(dir).filter((f) => f.endsWith('.up.sql')).sort();
  const c = new Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432),
    user: process.env.MIGRATION_USER ?? process.env.PGUSER, password: process.env.MIGRATION_PASSWORD ?? process.env.PGPASSWORD,
    database: process.env.PGDATABASE });
  await c.connect();
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
  for (const f of ups) {
    const done = await c.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [f]);
    if (done.rowCount) { console.log('skip', f); continue; }
    console.log('apply', f);
    await c.query('BEGIN');
    try { await c.query(fs.readFileSync(path.join(dir, f), 'utf8')); await c.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [f]); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); console.error('FAILED', f, e.message); process.exit(1); }
  }
  await c.end(); console.log('migrations complete');
}
main().catch((e) => { console.error(e); process.exit(1); });
