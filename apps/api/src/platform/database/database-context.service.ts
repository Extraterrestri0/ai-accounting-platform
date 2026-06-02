import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from './pg-pool';
import { ScopedClient } from './scoped-client';
import { TenantContextService } from '../tenant-context/tenant-context.service';

/**
 * Runs work inside a transaction with tenant/company context applied via
 * set_config(..., is_local := true) (= SET LOCAL). Transaction-local, so it resets
 * on COMMIT/ROLLBACK and cannot leak to the next request on a pooled connection.
 * Fail-closed: no context => MissingTenantContextError before any query.
 */
@Injectable()
export class DatabaseContextService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ctx: TenantContextService,
  ) {}

  async run<T>(work: (db: ScopedClient) => Promise<T>): Promise<T> {
    const holder = this.ctx.currentOrThrow(); // fail-closed
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [holder.tenantId]);
      await client.query("SELECT set_config('app.company_id', $1, true)", [holder.companyId ?? '']);
      const result = await work(new ScopedClient(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * NO-TENANT path — ONLY for the pre-auth login lookup, which must find a user by
   * email before any tenant is known. It explicitly sets EMPTY context (so any normal
   * RLS table is fully fail-closed) and may ONLY call the SECURITY DEFINER lookup
   * function. Do not use this for business queries.
   */
  async runWithoutTenant<T>(work: (db: ScopedClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', '', true)");
      await client.query("SELECT set_config('app.company_id', '', true)");
      const result = await work(new ScopedClient(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
