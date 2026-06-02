import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertEnv } from './config/env.schema';
import { startConsumers } from './worker/consumers';

/**
 * Queue worker (no HTTP port). Hosts the BullMQ consumers for scan + extraction.
 * Capability-limited: no human identity, cannot post or approve.
 */
async function bootstrap(): Promise<void> {
  const log = new Logger('Worker');
  assertEnv();
  if (!process.env.REDIS_URL) throw new Error('Worker requires REDIS_URL.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const workers = startConsumers(app);
  log.log(`Worker up — ${workers.length} queue consumers bound (scan, extraction).`);
  const shutdown = async (): Promise<void> => { await Promise.all(workers.map((w) => w.close())); await app.close(); process.exit(0); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
void bootstrap();
