/** The authenticated principal — derived from the SESSION, never from client input. */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly tenantId: string;
}

/**
 * Mutable per-request holder. tenantId/userId come from the session at the start
 * of the request; companyId is set ONLY after an assignment check (company switch).
 */
export interface TenantContextHolder {
  readonly tenantId: string;
  readonly userId: string;
  companyId?: string;
}
