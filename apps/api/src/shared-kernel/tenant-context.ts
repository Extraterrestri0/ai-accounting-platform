/** Per-request tenant scope. Carried into every query/job; RLS backstop relies on it. */
export interface TenantContext {
  readonly tenantId: string;
  readonly companyId?: string;
}
export const TENANT_CONTEXT = Symbol('TenantContext');
