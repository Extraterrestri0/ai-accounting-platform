import { Injectable } from '@nestjs/common';
import { DatabaseContextService } from '../../../platform';

@Injectable()
export class SessionRepository {
  constructor(private readonly db: DatabaseContextService) {}

  create(tenantId: string, userId: string, refreshHash: string, expiresAt: Date): Promise<string> {
    return this.db.run(async (db) => {
      const r = await db.query<{ id: string }>(
        `INSERT INTO auth_sessions (tenant_id, user_id, refresh_token_hash, expires_at)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [tenantId, userId, refreshHash, expiresAt.toISOString()]);
      return r.rows[0].id;
    });
  }
  findActiveByHash(refreshHash: string): Promise<{ id: string; userId: string } | null> {
    return this.db.run(async (db) => {
      const r = await db.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM auth_sessions
          WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`, [refreshHash]);
      return r.rows[0] ? { id: r.rows[0].id, userId: r.rows[0].user_id } : null;
    });
  }
  revoke(sessionId: string): Promise<void> {
    return this.db.run(async (db) => {
      await db.query(`UPDATE auth_sessions SET revoked_at = now() WHERE id = $1`, [sessionId]);
    });
  }
}
