/**
 * Bound a queue enqueue so an unreachable Redis fails fast instead of hanging.
 *
 * ioredis keeps an offline command queue and reconnects indefinitely, so a raw
 * `queue.add()` against a down Redis never settles — the HTTP request that triggered
 * it hangs forever (the document upload "spins" with no error). Racing the enqueue
 * against a timer turns that silent hang into a prompt, surfaceable failure.
 *
 * The underlying op always has handlers attached, so a late rejection never escapes
 * as an unhandled rejection.
 */
export const ENQUEUE_TIMEOUT_MS = Number(process.env.QUEUE_ENQUEUE_TIMEOUT_MS ?? 4000);

export function enqueueWithTimeout<T>(op: Promise<T>, label: string, ms = ENQUEUE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms — queue/Redis unavailable`)),
      ms,
    );
    op.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e instanceof Error ? e : new Error(String(e))); },
    );
  });
}
