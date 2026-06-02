import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { ActiveRule, RuleType } from '../domain/rules/models';

@Injectable()
export class RuleRepository {
  async createRule(db: ScopedClient, tenantId: string, companyId: string, r: { ruleType: RuleType; name: string; matchKey?: string }): Promise<string> {
    const res = await db.query<{ id: string }>(
      `INSERT INTO rules (tenant_id, company_id, rule_type, name, match_key) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantId, companyId, r.ruleType, r.name, r.matchKey ?? null]);
    return res.rows[0].id;
  }
  async addVersion(db: ScopedClient, tenantId: string, companyId: string, ruleId: string, definition: unknown, createdBy?: string): Promise<void> {
    const v = await db.query<{ n: number | null }>(`SELECT max(version_no) AS n FROM rule_versions WHERE rule_id=$1`, [ruleId]);
    await db.query(
      `INSERT INTO rule_versions (tenant_id, company_id, rule_id, version_no, definition, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, companyId, ruleId, (v.rows[0].n ?? 0) + 1, JSON.stringify(definition), createdBy ?? null]);
  }
  /** Active rules with their CURRENT (max-version) definition. */
  async listActive(db: ScopedClient, ruleType?: RuleType): Promise<ActiveRule[]> {
    const params: unknown[] = [];
    let sql = `SELECT r.rule_type, r.name, r.match_key, r.is_active, rv.definition
                 FROM rules r
                 JOIN LATERAL (SELECT definition FROM rule_versions v WHERE v.rule_id=r.id ORDER BY v.version_no DESC LIMIT 1) rv ON true
                WHERE r.is_active = true`;
    if (ruleType) { params.push(ruleType); sql += ` AND r.rule_type=$1`; }
    const res = await db.query<{ rule_type: RuleType; name: string; match_key: string | null; is_active: boolean; definition: { action?: { accountCode?: string; vatCode?: string; confidence?: number } } }>(sql, params);
    return res.rows.map((x) => ({ ruleType: x.rule_type, name: x.name, matchKey: x.match_key ?? undefined, isActive: x.is_active, action: x.definition.action ?? {} }));
  }
}
