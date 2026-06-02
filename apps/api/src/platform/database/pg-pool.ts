import { Pool } from 'pg';

export const PG_POOL = Symbol('PgPool');

/**
 * Pool factory. Connects as the RLS-SUBJECT role (app_user) — NEVER the owner,
 * NEVER a BYPASSRLS role. Credentials come from the secrets vault via env.
 */
export function createPgPool(): Pool {
  return new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER,        // must be app_user (subject to RLS)
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });
}
