/** Tenancy domain models (data shapes only — no behavior/business logic). */
export type TenantStatus = 'active' | 'suspended' | 'closed';
export type CompanyStatus = 'active' | 'suspended' | 'archived';
export type AssignmentStatus = 'active' | 'revoked';

export interface Tenant {
  id: string;
  name: string;
  status: TenantStatus;
  placement: 'shared' | 'dedicated';
  createdAt: string;
}

export interface Company {
  id: string;
  tenantId: string;
  organizationId?: string;
  name: string;
  eik?: string;
  vatStatus: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  status: CompanyStatus;
  createdAt: string;
}

export interface CompanyAssignment {
  id: string;
  tenantId: string;
  userId: string;
  companyId: string;
  role: string;
  status: AssignmentStatus;
  createdAt: string;
}
