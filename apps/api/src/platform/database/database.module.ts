import { Global, Module } from '@nestjs/common';
import { PG_POOL, createPgPool } from './pg-pool';
import { DatabaseContextService } from './database-context.service';
import { JobContextRunner } from './job-context.runner';
import { TenantContextService } from '../tenant-context/tenant-context.service';

@Global()
@Module({
  providers: [
    { provide: PG_POOL, useFactory: createPgPool },
    TenantContextService,
    DatabaseContextService,
    JobContextRunner,
  ],
  exports: [PG_POOL, TenantContextService, DatabaseContextService, JobContextRunner],
})
export class DatabaseModule {}
