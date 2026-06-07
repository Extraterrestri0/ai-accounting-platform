import { SaftQueueMonitor } from '../../src/modules/health/application/saft-queue.monitor';
import { HealthService } from '../../src/modules/health/application/health.service';

describe('SaftQueueMonitor — inert without REDIS_URL', () => {
  const prev = process.env.REDIS_URL;
  beforeAll(() => { delete process.env.REDIS_URL; });
  afterAll(() => { if (prev !== undefined) process.env.REDIS_URL = prev; });

  it('is unavailable and returns null stats / unreachable redis when no queue is configured', async () => {
    const m = new SaftQueueMonitor();
    expect(m.available()).toBe(false);
    expect(await m.stats()).toBeNull();
    expect(await m.redisReachable()).toBe(false);
    await m.onModuleDestroy();
  });
});

describe('HealthService.saftQueueHealth — failure monitoring', () => {
  const svc = (monitor: Partial<SaftQueueMonitor>) => new HealthService({} as any, {} as any, monitor as SaftQueueMonitor);

  it("reports 'disabled' when the queue is not configured", async () => {
    const r = await svc({ available: () => false }).saftQueueHealth();
    expect(r.status).toBe('disabled');
  });

  it("reports 'down' when Redis is unreachable", async () => {
    const r = await svc({ available: () => true, redisReachable: async () => false }).saftQueueHealth();
    expect(r.status).toBe('down');
  });

  it("reports 'degraded' when there are no workers but a backlog exists", async () => {
    const r = await svc({
      available: () => true, redisReachable: async () => true,
      stats: async () => ({ waiting: 3, active: 0, delayed: 0, failed: 0, completed: 0, workers: 0, stuckQueued: 0, stuckProcessing: 0 }),
    }).saftQueueHealth();
    expect(r.status).toBe('degraded');
    expect(r.detail).toContain('no workers running with backlog');
  });

  it("reports 'degraded' on stuck/failed jobs", async () => {
    const r = await svc({
      available: () => true, redisReachable: async () => true,
      stats: async () => ({ waiting: 0, active: 1, delayed: 0, failed: 2, completed: 5, workers: 1, stuckQueued: 0, stuckProcessing: 1 }),
    }).saftQueueHealth();
    expect(r.status).toBe('degraded');
    expect(r.detail).toContain('stuck processing');
    expect(r.detail).toContain('failed (DLQ)');
  });

  it("reports 'up' when healthy", async () => {
    const r = await svc({
      available: () => true, redisReachable: async () => true,
      stats: async () => ({ waiting: 0, active: 1, delayed: 0, failed: 0, completed: 9, workers: 2, stuckQueued: 0, stuckProcessing: 0 }),
    }).saftQueueHealth();
    expect(r.status).toBe('up');
  });
});
