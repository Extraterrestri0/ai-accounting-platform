import IORedis, { type Redis, type RedisOptions } from 'ioredis';

/** BullMQ connection options parsed from REDIS_URL (maxRetriesPerRequest: null is required). */
export function getRedisConnection(): RedisOptions {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required for the queue subsystem.');
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };
}

/** Standalone ioredis client (non-BullMQ uses). */
let conn: Redis | null = null;
export function getRedis(): Redis {
  if (!conn) conn = new IORedis(getRedisConnection());
  return conn;
}
export const QUEUE_NAMES = { scan: 'doc-scan', extraction: 'doc-extraction' } as const;
