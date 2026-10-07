import { Global, Module } from '@nestjs/common';
import { PG_POOL, createPgPool } from './pg-pool';
import { DatabaseContextService } from './database-context.service';
import { IdempotencyRepository } from './idempotency.repository';
import { JobContextRunner } from './job-context.runner';
import { TenantContextService } from '../tenant-context/tenant-context.service';

@Global()
@Module({
  providers: [
    { provide: PG_POOL, useFactory: createPgPool },
    TenantContextService,
    DatabaseContextService,
    IdempotencyRepository,
    JobContextRunner,
  ],
  exports: [PG_POOL, TenantContextService, DatabaseContextService, IdempotencyRepository, JobContextRunner],
})
export class DatabaseModule {}
