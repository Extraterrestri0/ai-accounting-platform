/** Request body for company creation. NOTE: there is deliberately NO tenantId field —
 *  tenant scope is derived from the authenticated session, never from the client. */
export interface CreateCompanyDto {
  name: string;
  organizationId?: string;
  eik?: string;
  vatStatus?: string;
  baseCurrency?: string;
  fiscalYearStartMonth?: number;
}
