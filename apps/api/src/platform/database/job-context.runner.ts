import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { DatabaseContextService } from './database-context.service';
import type { TenantContextHolder } from '../tenant-context/tenant-context';

/**
 * Background jobs carry tenant/company in their payload and MUST re-apply it
 * before any DB access. This runner re-establishes context, then delegates to
 * the same transaction+RLS path as HTTP requests.
 */
@Injectable()
export class JobContextRunner {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
  ) {}

  run<T>(holder: TenantContextHolder, work: () => Promise<T>): Promise<T> {
    return this.ctx.run(holder, () => work());
  }
}
