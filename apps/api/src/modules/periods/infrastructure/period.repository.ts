import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import { periodKey } from '../domain/period';
import type { AccountingPeriod, PeriodStatus } from '../domain/models';

interface PeriodRowDb {
  id: string; year: number; month: number; status: PeriodStatus;
  locked_by: string | null; locked_by_email: string | null; locked_at: string | null;
}

function mapRow(r: PeriodRowDb, current: { year: number; month: number }): AccountingPeriod {
  return {
    id: r.id, year: r.year, month: r.month, key: periodKey(r.year, r.month), status: r.status,
    lockedBy: r.locked_by ?? undefined, lockedByEmail: r.locked_by_email ?? undefined,
    lockedAt: r.locked_at ?? undefined, isCurrent: r.year === current.year && r.month === current.month,
  };
}

@Injectable()
export class PeriodRepository {
  /** Stored period row for (year, month), or null when never touched (= open). */
  async find(db: ScopedClient, companyId: string, year: number, month: number, current: { year: number; month: number }): Promise<AccountingPeriod | null> {
    const r = await db.query<PeriodRowDb>(
      `SELECT ap.id, ap.year, ap.month, ap.status, ap.locked_by, u.email AS locked_by_email, ap.locked_at::text AS locked_at
         FROM accounting_periods ap
         LEFT JOIN users u ON u.id = ap.locked_by
        WHERE ap.company_id = $1 AND ap.year = $2 AND ap.month = $3`, [companyId, year, month]);
    return r.rows[0] ? mapRow(r.rows[0], current) : null;
  }

  /** All stored period rows for the company (most recent first). */
  async list(db: ScopedClient, companyId: string, current: { year: number; month: number }): Promise<AccountingPeriod[]> {
    const r = await db.query<PeriodRowDb>(
      `SELECT ap.id, ap.year, ap.month, ap.status, ap.locked_by, u.email AS locked_by_email, ap.locked_at::text AS locked_at
         FROM accounting_periods ap
         LEFT JOIN users u ON u.id = ap.locked_by
        WHERE ap.company_id = $1 ORDER BY ap.year DESC, ap.month DESC`, [companyId]);
    return r.rows.map((x) => mapRow(x, current));
  }

  /** Upsert the period to a status. On lock, stamp locked_by/at; on open, clear them. */
  async upsert(db: ScopedClient, tenantId: string, companyId: string, year: number, month: number, status: PeriodStatus, userId?: string): Promise<void> {
    const lockedBy = status === 'locked' ? (userId ?? null) : null;
    const lockedAt = status === 'locked' ? 'now()' : 'NULL';
    await db.query(
      `INSERT INTO accounting_periods (tenant_id, company_id, year, month, status, locked_by, locked_at)
       VALUES ($1,$2,$3,$4,$5,$6, ${lockedAt})
       ON CONFLICT (tenant_id, company_id, year, month)
       DO UPDATE SET status = EXCLUDED.status, locked_by = EXCLUDED.locked_by,
                     locked_at = ${status === 'locked' ? 'now()' : 'NULL'}, updated_at = now()`,
      [tenantId, companyId, year, month, status, lockedBy]);
  }
}
