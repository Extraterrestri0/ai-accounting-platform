import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { AccountRole } from '../domain/account-mapping';

export interface MappingRow { role: AccountRole; account_id: string; code: string; name: string; }
export interface MappingAccount { id: string; code: string; name: string; isPostable: boolean; status: string; }

/** Persistence for per-company role→account mappings (RLS-scoped to the active company). */
@Injectable()
export class AccountMappingRepository {
  /** Current explicit mappings, joined to their account for code + name. */
  async list(db: ScopedClient, tenantId: string, companyId: string): Promise<MappingRow[]> {
    const r = await db.query<MappingRow>(
      `SELECT m.role, m.account_id, a.code, a.name
         FROM account_mappings m
         JOIN accounts a ON a.id = m.account_id
        WHERE m.tenant_id = $1 AND m.company_id = $2`,
      [tenantId, companyId]);
    return r.rows;
  }

  /** Resolve an account by id within the active company (RLS-scoped) for validation. */
  async getAccount(db: ScopedClient, accountId: string): Promise<MappingAccount | null> {
    const r = await db.query<{ id: string; code: string; name: string; is_postable: boolean; status: string }>(
      `SELECT id, code, name, is_postable, status FROM accounts WHERE id = $1`, [accountId]);
    const a = r.rows[0];
    return a ? { id: a.id, code: a.code, name: a.name, isPostable: a.is_postable, status: a.status } : null;
  }

  /** Idempotent upsert of a single role mapping. */
  async upsert(db: ScopedClient, tenantId: string, companyId: string, role: AccountRole, accountId: string, userId?: string): Promise<void> {
    await db.query(
      `INSERT INTO account_mappings (tenant_id, company_id, role, account_id, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, company_id, role)
       DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [tenantId, companyId, role, accountId, userId ?? null]);
  }
}
