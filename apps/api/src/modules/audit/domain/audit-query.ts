import type { AuditFilter } from './models';

/** Action category = the prefix before the first dot (e.g. 'invoicing.invoice_issued' → 'invoicing'). */
export function categoryOf(action: string): string {
  const i = action.indexOf('.');
  return i > 0 ? action.slice(0, i) : action || 'other';
}

/**
 * Build the parameterized WHERE clause for an audit query — PURE so it can be unit
 * tested for filtering/pagination correctness. The active company is ALWAYS the
 * first bound parameter (company-scoping is non-optional; tenant isolation is RLS).
 * `action` matches either an exact action or a whole category (prefix + '.%').
 */
export function buildAuditWhere(companyId: string, f: AuditFilter): { sql: string; params: unknown[] } {
  const clauses: string[] = ['ae.company_id = $1'];
  const params: unknown[] = [companyId];
  const add = (frag: (i: number) => string, val: unknown): void => {
    params.push(val);
    clauses.push(frag(params.length));
  };
  if (f.actorType) add((i) => `ae.actor_type = $${i}`, f.actorType);
  if (f.actorId) add((i) => `ae.actor_id = $${i}`, f.actorId);
  if (f.entityType) add((i) => `ae.entity_type = $${i}`, f.entityType);
  if (f.entityId) add((i) => `ae.entity_id = $${i}`, f.entityId);
  if (f.action) add((i) => `(ae.action = $${i} OR ae.action LIKE $${i} || '.%')`, f.action);
  if (f.from) add((i) => `ae.occurred_at >= $${i}`, f.from);
  if (f.to) add((i) => `ae.occurred_at <= $${i}`, f.to);
  if (f.search) add((i) => `(ae.action ILIKE '%' || $${i} || '%' OR ae.entity_type ILIKE '%' || $${i} || '%' OR ae.reason ILIKE '%' || $${i} || '%')`, f.search);
  return { sql: clauses.join(' AND '), params };
}

/** Clamp pagination to safe bounds (1-based page; pageSize 1..200, default 50). */
export function clampPage(page?: number, pageSize?: number): { page: number; pageSize: number; limit: number; offset: number } {
  const p = Math.max(1, Math.floor(page ?? 1));
  const size = Math.min(200, Math.max(1, Math.floor(pageSize ?? 50)));
  return { page: p, pageSize: size, limit: size, offset: (p - 1) * size };
}
