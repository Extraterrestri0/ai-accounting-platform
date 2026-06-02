import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { Account, AccountNode, AccountType, NormalBalance } from '../domain/models';

interface Row {
  id: string; company_id: string; code: string; name: string; type: AccountType;
  normal_balance: NormalBalance; parent_account_id: string | null; category: string | null;
  is_postable: boolean; status: string;
}
const map = (r: Row): Account => ({
  id: r.id, companyId: r.company_id, code: r.code, name: r.name, type: r.type,
  normalBalance: r.normal_balance, parentAccountId: r.parent_account_id ?? undefined,
  category: r.category ?? undefined, isPostable: r.is_postable, status: r.status,
});

@Injectable()
export class AccountRepository {
  async insert(db: ScopedClient, tenantId: string, companyId: string, a: {
    code: string; name: string; type: AccountType; normalBalance: NormalBalance;
    parentAccountId?: string; category?: string; isPostable?: boolean;
  }): Promise<Account> {
    const r = await db.query<Row>(
      `INSERT INTO accounts (tenant_id, company_id, code, name, type, normal_balance, parent_account_id, category, is_postable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, companyId, a.code, a.name, a.type, a.normalBalance, a.parentAccountId ?? null, a.category ?? null, a.isPostable ?? true]);
    return map(r.rows[0]);
  }
  async search(db: ScopedClient, q: string, activeOnly: boolean): Promise<Account[]> {
    const params: unknown[] = [`%${q.toLowerCase()}%`];
    let sql = `SELECT * FROM accounts WHERE (lower(name) LIKE $1 OR code LIKE $1)`;
    if (activeOnly) sql += ` AND status='active'`;
    sql += ` ORDER BY code LIMIT 50`;
    const r = await db.query<Row>(sql, params);
    return r.rows.map(map);
  }
  async listAll(db: ScopedClient): Promise<Account[]> {
    const r = await db.query<Row>(`SELECT * FROM accounts ORDER BY code`);
    return r.rows.map(map);
  }
  /** Build the account hierarchy (tree) from the flat list. */
  buildTree(accounts: Account[]): AccountNode[] {
    const byId = new Map<string, AccountNode>();
    accounts.forEach((a) => byId.set(a.id, { ...a, children: [] }));
    const roots: AccountNode[] = [];
    byId.forEach((node) => {
      if (node.parentAccountId && byId.has(node.parentAccountId)) byId.get(node.parentAccountId)!.children.push(node);
      else roots.push(node);
    });
    return roots;
  }
}
