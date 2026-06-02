import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { MissingTenantContextError } from './errors';
import type { TenantContextHolder } from './tenant-context';

/**
 * Request-scoped tenant context via AsyncLocalStorage.
 * Context is established once per request (middleware) and per job (runner),
 * and never shared between them. Reading it without a context fails closed.
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContextHolder>();

  /** Run `fn` with the given context bound for its entire async lifetime. */
  run<T>(holder: TenantContextHolder, fn: () => T): T {
    return this.als.run(holder, fn);
  }

  /** Current context or undefined (no throw). */
  current(): TenantContextHolder | undefined {
    return this.als.getStore();
  }

  /** Current context or throw — used at the DB boundary (fail-closed). */
  currentOrThrow(): TenantContextHolder {
    const ctx = this.als.getStore();
    if (!ctx || !ctx.tenantId) throw new MissingTenantContextError();
    return ctx;
  }

  /** Set the active company AFTER an assignment check has authorized it. */
  setActiveCompany(companyId: string): void {
    const ctx = this.currentOrThrow();
    ctx.companyId = companyId;
  }
}
