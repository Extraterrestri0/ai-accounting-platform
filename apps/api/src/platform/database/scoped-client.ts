import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * A query interface bound to ONE connection inside an open, tenant-scoped
 * transaction. Repositories receive this — they never acquire connections
 * themselves, guaranteeing every query runs under the SET LOCAL context.
 */
export class ScopedClient {
  constructor(private readonly client: PoolClient) {}

  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<R>> {
    return this.client.query<R>(text, params as unknown[] | undefined);
  }
}
