import { validateEnv } from '../../src/config/env.schema';
import { HealthService, type StorageHealthProbe } from '../../src/modules/health/application/health.service';

const FULL_ENV = {
  NODE_ENV: 'test', PORT: '3000', PGHOST: 'db', PGPORT: '5432', PGUSER: 'app_user', PGPASSWORD: 'a-very-strong-secret-value', PGDATABASE: 'acct',
  JWT_SECRET: 'another-strong-secret-value-32chars', REDIS_URL: 'redis://r:6379', STORAGE_ENDPOINT: 'http://minio:9000', STORAGE_BUCKET: 'docs', STORAGE_REGION: 'eu-central-1', CORS_ORIGINS: 'http://localhost:3000',
} as unknown as NodeJS.ProcessEnv;

describe('env validation', () => {
  it('passes when all required vars are present', () => {
    expect(validateEnv(FULL_ENV)).toEqual({ ok: true, missing: [], weak: [] });
  });
  it('reports missing vars', () => {
    const r = validateEnv({ ...FULL_ENV, JWT_SECRET: undefined } as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false); expect(r.missing).toContain('JWT_SECRET');
  });
  it('flags weak/placeholder secrets in production', () => {
    const r = validateEnv({ ...FULL_ENV, NODE_ENV: 'production', JWT_SECRET: 'changeme' } as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false); expect(r.weak).toContain('JWT_SECRET');
  });
});

describe('health service', () => {
  const okStorage: StorageHealthProbe = { ping: async () => ({ ok: true }) };
  const downStorage: StorageHealthProbe = { ping: async () => ({ ok: false, detail: 'no bucket' }) };
  const poolOk = { query: async () => ({ rows: [{ '?column?': 1 }] }) } as any;
  const poolDown = { query: async () => { throw new Error('ECONNREFUSED'); } } as any;

  it('liveness is always ok when the process runs', () => {
    const h = new HealthService(poolOk, okStorage);
    expect(h.liveness().status).toBe('ok');
  });
  it('readiness up when db + storage up', async () => {
    process.env.NODE_ENV = 'test';
    const h = new HealthService(poolOk, okStorage);
    const r = await h.readiness();
    expect(r.checks.database.status).toBe('up');
  });
  it('health is degraded when storage down but db up', async () => {
    const h = new HealthService(poolOk, downStorage);
    expect((await h.health()).status).toBe('degraded');
  });
  it('health is down when db down', async () => {
    const h = new HealthService(poolDown, okStorage);
    expect((await h.health()).status).toBe('down');
  });
});
