/** The user has no active assignment to the requested company (or it's cross-tenant). */
export class CompanyNotAssignedError extends Error {
  constructor(companyId: string) {
    super(`Access to company ${companyId} is not permitted.`);
    this.name = 'CompanyNotAssignedError';
  }
}
