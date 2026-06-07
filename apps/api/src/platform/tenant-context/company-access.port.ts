/**
 * Port: authorize the current principal for an ACTIVE company.
 * Implemented by the Tenancy context (checks company_assignments under RLS).
 * The middleware uses it to honor: companyId is set ONLY after an assignment check.
 * Platform defines the port; the bounded context provides the implementation
 * (mirrors PrincipalResolver) — platform never imports a module.
 */
export interface CompanyAccessPort {
  /** True iff the current user (from context) has an active assignment to `companyId`. */
  isAccessible(companyId: string): Promise<boolean>;
}
export const COMPANY_ACCESS_PORT = Symbol('CompanyAccessPort');
