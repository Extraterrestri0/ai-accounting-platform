import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { AuditEventInput } from '../domain/models';

@Injectable()
export class AuditRepository {
  /** Insert ONLY business columns; the BEFORE INSERT trigger assigns seq/prev_hash/this_hash. */
  async append(db: ScopedClient, tenantId: string, e: AuditEventInput): Promise<void> {
    await db.query(
      `INSERT INTO audit_events
         (tenant_id, company_id, actor_type, actor_id, action, entity_type, entity_id, reason,
          before_snapshot, after_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tenantId, e.companyId ?? null, e.actorType, e.actorId ?? null, e.action,
        e.entityType, e.entityId ?? null, e.reason ?? null,
        e.before === undefined ? null : JSON.stringify(e.before),
        e.after === undefined ? null : JSON.stringify(e.after),
      ],
    );
  }

  async verifyChain(db: ScopedClient, tenantId: string): Promise<boolean> {
    const res = await db.query<{ ok: boolean }>(
      `SELECT app.verify_audit_chain($1) AS ok`, [tenantId]);
    return res.rows[0]?.ok === true;
  }
}
