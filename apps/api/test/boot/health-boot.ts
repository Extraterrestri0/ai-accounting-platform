import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import { PG_POOL } from '../../src/platform/database/pg-pool';
import { HealthController } from '../../src/modules/health/api/health.controller';
import { HealthService, STORAGE_HEALTH_PROBE } from '../../src/modules/health/application/health.service';
import { LocalStorageProbe } from '../../src/modules/health/application/local-storage.probe';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: STORAGE_HEALTH_PROBE, useClass: LocalStorageProbe },
    { provide: PG_POOL, useFactory: () => new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE, max: 4 }) },
  ],
})
class HealthBootModule {}

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(HealthBootModule, { logger: ['error', 'warn', 'log'] });
  await app.listen(3999, '0.0.0.0');
  console.log('HEALTH_BOOT_LISTENING');
}
void main();
