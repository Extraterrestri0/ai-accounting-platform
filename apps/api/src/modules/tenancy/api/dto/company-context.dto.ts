/** Returned after a successful company switch — the minimal context the frontend needs. */
export interface CompanyContextDto {
  companyId: string;
  name: string;
  baseCurrency: string;
}
