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
  // Queue monitor stubs — disabled (no Redis), so they never affect these checks.
  const queue = { available: () => false } as any;
  const docPipeline = { available: () => false } as any;

  it('liveness is always ok when the process runs', () => {
    const h = new HealthService(poolOk, okStorage, queue, docPipeline);
    expect(h.liveness().status).toBe('ok');
  });
  it('readiness up when db + storage up', async () => {
    process.env.NODE_ENV = 'test';
    const h = new HealthService(poolOk, okStorage, queue, docPipeline);
    const r = await h.readiness();
    expect(r.checks.database.status).toBe('up');
  });
  it('health is degraded when storage down but db up', async () => {
    const h = new HealthService(poolOk, downStorage, queue, docPipeline);
    expect((await h.health()).status).toBe('degraded');
  });
  it('health is down when db down', async () => {
    const h = new HealthService(poolDown, okStorage, queue, docPipeline);
    expect((await h.health()).status).toBe('down');
  });
  it('health reports the docPipeline check (disabled without Redis)', async () => {
    const h = new HealthService(poolOk, okStorage, queue, docPipeline);
    const r = await h.health();
    expect(r.checks.docPipeline.status).toBe('disabled');
    expect(r.status).toBe('ok');
  });
  it('health is degraded when the document pipeline is down', async () => {
    const downPipe = { available: () => true, redisReachable: async () => false } as any;
    const h = new HealthService(poolOk, okStorage, queue, downPipe);
    const r = await h.health();
    expect(r.checks.docPipeline.status).toBe('down');
    expect(r.status).toBe('degraded');
  });
});
