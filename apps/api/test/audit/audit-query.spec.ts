import { buildAuditWhere, categoryOf, clampPage } from '../../src/modules/audit/domain/audit-query';

describe('audit action category (Task 4.1)', () => {
  it('takes the prefix before the first dot', () => {
    expect(categoryOf('invoicing.invoice_issued')).toBe('invoicing');
    expect(categoryOf('payment.recorded')).toBe('payment');
    expect(categoryOf('receivable.closed')).toBe('receivable');
    expect(categoryOf('ledger.entry_posted')).toBe('ledger');
  });
  it('falls back gracefully for prefixless actions', () => {
    expect(categoryOf('login')).toBe('login');
    expect(categoryOf('')).toBe('other');
  });
});

describe('audit WHERE builder — filtering (Task 4.1)', () => {
  const COMPANY = 'c1';

  it('always scopes to the active company as $1 (company isolation)', () => {
    const { sql, params } = buildAuditWhere(COMPANY, {});
    expect(sql).toBe('ae.company_id = $1');
    expect(params).toEqual([COMPANY]);
  });

  it('adds actor, entity and date-range filters with sequential params', () => {
    const { sql, params } = buildAuditWhere(COMPANY, {
      actorType: 'user', entityType: 'invoice', from: '2026-01-01', to: '2026-06-30',
    });
    expect(sql).toContain('ae.actor_type = $2');
    expect(sql).toContain('ae.entity_type = $3');
    expect(sql).toContain('ae.occurred_at >= $4');
    expect(sql).toContain('ae.occurred_at <= $5');
    expect(params).toEqual([COMPANY, 'user', 'invoice', '2026-01-01', '2026-06-30']);
  });

  it('matches an action exactly OR as a whole category prefix', () => {
    const { sql, params } = buildAuditWhere(COMPANY, { action: 'invoicing' });
    expect(sql).toContain("(ae.action = $2 OR ae.action LIKE $2 || '.%')");
    expect(params).toEqual([COMPANY, 'invoicing']);
  });

  it('builds a case-insensitive search across action/entity/reason', () => {
    const { sql, params } = buildAuditWhere(COMPANY, { search: 'paid' });
    expect(sql).toContain('ae.action ILIKE');
    expect(sql).toContain('ae.reason ILIKE');
    expect(params).toEqual([COMPANY, 'paid']);
  });

  it('combines all clauses with AND and never drops the company scope', () => {
    const { sql } = buildAuditWhere(COMPANY, { actorId: 'u1', entityId: 'e1', search: 'x' });
    expect(sql.startsWith('ae.company_id = $1 AND')).toBe(true);
    expect(sql.split(' AND ')).toHaveLength(4);
  });
});

describe('audit pagination clamp (Task 4.1)', () => {
  it('defaults to page 1 / size 50', () => {
    expect(clampPage()).toEqual({ page: 1, pageSize: 50, limit: 50, offset: 0 });
  });
  it('computes the offset from page and size', () => {
    expect(clampPage(3, 25)).toEqual({ page: 3, pageSize: 25, limit: 25, offset: 50 });
  });
  it('clamps out-of-range input to safe bounds', () => {
    expect(clampPage(0, 0)).toMatchObject({ page: 1, pageSize: 1 });
    expect(clampPage(-5, 9999)).toMatchObject({ page: 1, pageSize: 200 });
  });
});
