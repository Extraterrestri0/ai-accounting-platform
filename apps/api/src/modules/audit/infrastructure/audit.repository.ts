import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import { buildAuditWhere, categoryOf } from '../domain/audit-query';
import type { ActorType, AuditEventInput, AuditEventRecord, AuditFilter, AuditSummary } from '../domain/models';

interface AuditRowDb {
  id: string; seq: string; company_id: string | null; actor_type: ActorType; actor_id: string | null;
  actor_email: string | null; action: string; entity_type: string; entity_id: string | null;
  reason: string | null; before_snapshot: unknown; after_snapshot: unknown; occurred_at: string;
}

function mapRow(r: AuditRowDb): AuditEventRecord {
  return {
    id: r.id, seq: Number(r.seq), companyId: r.company_id ?? undefined,
    actorType: r.actor_type, actorId: r.actor_id ?? undefined, actorEmail: r.actor_email ?? undefined,
    action: r.action, category: categoryOf(r.action), entityType: r.entity_type,
    entityId: r.entity_id ?? undefined, reason: r.reason ?? undefined,
    before: r.before_snapshot ?? undefined, after: r.after_snapshot ?? undefined, occurredAt: r.occurred_at,
  };
}

// Actor email is resolved via a LEFT JOIN on users (read-model join; RLS keeps it
// tenant-scoped). Only business-safe columns are projected — the hash-chain columns
// (prev_hash/this_hash) are never exposed to clients.
const SELECT = `
  SELECT ae.id, ae.seq, ae.company_id, ae.actor_type, ae.actor_id, u.email AS actor_email,
         ae.action, ae.entity_type, ae.entity_id, ae.reason,
         ae.before_snapshot, ae.after_snapshot, ae.occurred_at::text AS occurred_at
    FROM audit_events ae
    LEFT JOIN users u ON u.id = ae.actor_id`;

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

  /** Filtered, paginated read of the active company's audit trail (most-recent first). */
  async list(db: ScopedClient, companyId: string, filter: AuditFilter, limit: number, offset: number): Promise<{ items: AuditEventRecord[]; total: number }> {
    const { sql, params } = buildAuditWhere(companyId, filter);
    const rows = await db.query<AuditRowDb>(
      `${SELECT} WHERE ${sql} ORDER BY ae.seq DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]);
    const count = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events ae WHERE ${sql}`, params);
    return { items: rows.rows.map(mapRow), total: Number(count.rows[0]?.n ?? 0) };
  }

  /** Complete chronological history for one entity (oldest → newest). */
  async byEntity(db: ScopedClient, companyId: string, entityType: string, entityId: string): Promise<AuditEventRecord[]> {
    const r = await db.query<AuditRowDb>(
      `${SELECT} WHERE ae.company_id = $1 AND ae.entity_type = $2 AND ae.entity_id = $3 ORDER BY ae.seq ASC`,
      [companyId, entityType, entityId]);
    return r.rows.map(mapRow);
  }

  /** Aggregate counts for the active company within an optional date range. */
  async summary(db: ScopedClient, companyId: string, from?: string, to?: string): Promise<AuditSummary> {
    const { sql, params } = buildAuditWhere(companyId, { from, to });
    const totals = await db.query<{ total: string; actors: string; first_at: string | null; last_at: string | null }>(
      `SELECT count(*)::text AS total, count(DISTINCT ae.actor_id)::text AS actors,
              min(ae.occurred_at)::text AS first_at, max(ae.occurred_at)::text AS last_at
         FROM audit_events ae WHERE ${sql}`, params);
    const byActor = await db.query<{ actor_type: string; n: string }>(
      `SELECT ae.actor_type, count(*)::text AS n FROM audit_events ae WHERE ${sql} GROUP BY ae.actor_type ORDER BY n DESC`, params);
    const byCat = await db.query<{ category: string; n: string }>(
      `SELECT split_part(ae.action, '.', 1) AS category, count(*)::text AS n
         FROM audit_events ae WHERE ${sql} GROUP BY 1 ORDER BY n DESC`, params);
    const t = totals.rows[0];
    return {
      total: Number(t?.total ?? 0),
      distinctActors: Number(t?.actors ?? 0),
      byActorType: byActor.rows.map((x) => ({ actorType: x.actor_type, count: Number(x.n) })),
      byCategory: byCat.rows.map((x) => ({ category: x.category, count: Number(x.n) })),
      firstAt: t?.first_at ?? undefined,
      lastAt: t?.last_at ?? undefined,
    };
  }

  async verifyChain(db: ScopedClient, tenantId: string): Promise<boolean> {
    const res = await db.query<{ ok: boolean }>(`SELECT app.verify_audit_chain($1) AS ok`, [tenantId]);
    return res.rows[0]?.ok === true;
  }

  /** Chain length for the current tenant (for the integrity panel). */
  async chainLength(db: ScopedClient, tenantId: string): Promise<number> {
    const r = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM audit_events WHERE tenant_id = $1`, [tenantId]);
    return Number(r.rows[0]?.n ?? 0);
  }
}
