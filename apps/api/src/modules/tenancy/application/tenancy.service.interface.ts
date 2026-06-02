import type { ApplicationService } from '../../../shared-kernel';
import type { Company } from '../domain/models';

export interface CreateCompanyInput {
  name: string;
  organizationId?: string;
  eik?: string;
  vatStatus?: string;
  baseCurrency?: string;       // defaults to EUR
  fiscalYearStartMonth?: number;
}

/**
 * PUBLIC application service for the Tenancy context.
 * tenant scope is taken from the request context — NEVER from inputs.
 */
export interface ITenancyService extends ApplicationService {
  /** Create a company in the CURRENT tenant and assign the current user to it. */
  createCompany(input: CreateCompanyInput): Promise<Company>;
  /** Companies the current user is assigned to (current tenant). */
  listMyCompanies(): Promise<Company[]>;
  /** Authorize the current user for a company; throws CompanyNotAssignedError if not. */
  assertCompanyAccess(companyId: string): Promise<void>;
  /** Validate access then make `companyId` the active company for the request. */
  switchCompany(companyId: string): Promise<Company>;
}
export const TENANCY_SERVICE = Symbol('Tenancy.Service');
