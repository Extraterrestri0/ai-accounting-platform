/** Required environment variables grouped by concern. Pure validation — no side effects. */
export const REQUIRED_ENV = [
  'NODE_ENV',
  'PORT',
  'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
  'JWT_SECRET',
  'REDIS_URL',
  'STORAGE_ENDPOINT', 'STORAGE_BUCKET', 'STORAGE_REGION',
  'CORS_ORIGINS',
] as const;

/** Secrets that must never be empty/placeholder in production. */
const PRODUCTION_SECRETS = ['JWT_SECRET', 'PGPASSWORD'] as const;
const PLACEHOLDERS = ['', 'changeme', 'secret', 'password', 'todo'];

export interface EnvValidationResult { ok: boolean; missing: string[]; weak: string[]; }

export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const missing = REQUIRED_ENV.filter((k) => env[k] === undefined || env[k] === '');
  const isProd = env.NODE_ENV === 'production';
  const weak = isProd
    ? PRODUCTION_SECRETS.filter((k) => { const v = (env[k] ?? '').toLowerCase(); return PLACEHOLDERS.includes(v) || (env[k] ?? '').length < 16; })
    : [];
  return { ok: missing.length === 0 && weak.length === 0, missing, weak };
}

export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
  const r = validateEnv(env);
  if (!r.ok) {
    const parts: string[] = [];
    if (r.missing.length) parts.push(`missing: ${r.missing.join(', ')}`);
    if (r.weak.length) parts.push(`weak/placeholder secrets in production: ${r.weak.join(', ')}`);
    throw new Error(`Environment validation failed — ${parts.join('; ')}.`);
  }
}
