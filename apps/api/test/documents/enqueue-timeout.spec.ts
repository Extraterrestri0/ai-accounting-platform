import { enqueueWithTimeout } from '../../src/platform/queue/enqueue-timeout';

describe('enqueueWithTimeout', () => {
  it('resolves with the value when the op settles in time', async () => {
    await expect(enqueueWithTimeout(Promise.resolve('ok'), 'test', 50)).resolves.toBe('ok');
  });

  it('rejects fast when the op hangs (Redis offline-queue never settles)', async () => {
    const hang = new Promise<void>(() => { /* never resolves */ });
    await expect(enqueueWithTimeout(hang, 'scan enqueue', 20)).rejects.toThrow(/queue\/Redis unavailable/);
  });

  it('propagates the underlying error', async () => {
    await expect(enqueueWithTimeout(Promise.reject(new Error('ECONNREFUSED')), 'test', 50)).rejects.toThrow('ECONNREFUSED');
  });
});
