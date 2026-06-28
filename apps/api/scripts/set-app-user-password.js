/* Provision the runtime app_user's password from APP_USER_PASSWORD, connecting as
   the migration/owner role. Migration 0001 creates app_user *passwordless* (the
   password is set out-of-band from the vault, never in migrations). Run AFTER
   migrations. Idempotent — safe to re-run. */
const { Client } = require('pg');

async function main() {
  const pw = process.env.APP_USER_PASSWORD;
  if (!pw) {
    console.error('set-app-user-password: APP_USER_PASSWORD is required');
    process.exit(1);
  }
  const c = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.MIGRATION_USER ?? process.env.PGUSER,
    password: process.env.MIGRATION_PASSWORD ?? process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });
  await c.connect();
  // ALTER ROLE ... PASSWORD does not accept bind parameters; build a safely-quoted
  // string literal (single quotes doubled). Value comes from a trusted env var.
  const literal = "'" + pw.replace(/'/g, "''") + "'";
  await c.query(`ALTER ROLE app_user LOGIN PASSWORD ${literal}`);
  await c.end();
  console.log('set-app-user-password: app_user password set');
}

main().catch((e) => { console.error('set-app-user-password failed:', e.message); process.exit(1); });
