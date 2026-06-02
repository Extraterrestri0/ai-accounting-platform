import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../platform';
import { CompanyRepository } from '../infrastructure/company.repository';
import { CompanyAssignmentRepository } from '../infrastructure/company-assignment.repository';
import { CompanyNotAssignedError } from '../domain/errors';
import type { Company } from '../domain/models';
import type { CreateCompanyInput, ITenancyService } from './tenancy.service.interface';

@Injectable()
export class TenancyService implements ITenancyService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly companies: CompanyRepository,
    private readonly assignments: CompanyAssignmentRepository,
  ) {}

  async createCompany(input: CreateCompanyInput): Promise<Company> {
    const { tenantId, userId } = this.ctx.currentOrThrow(); // tenant from SESSION, not input
    const company = await this.companies.create(tenantId, {
      organizationId: input.organizationId,
      name: input.name,
      eik: input.eik,
      vatStatus: input.vatStatus ?? 'none',
      baseCurrency: input.baseCurrency ?? 'EUR',
      fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
    });
    // Assign the creator so they can switch into it.
    await this.assignments.create(tenantId, userId, company.id, 'owner');
    return company;
  }

  listMyCompanies(): Promise<Company[]> {
    const { userId } = this.ctx.currentOrThrow();
    return this.companies.listForUser(userId);
  }

  async assertCompanyAccess(companyId: string): Promise<void> {
    const { userId } = this.ctx.currentOrThrow();
    const ok = await this.assignments.hasActiveAssignment(userId, companyId);
    if (!ok) throw new CompanyNotAssignedError(companyId); // cross-tenant also lands here
  }

  async switchCompany(companyId: string): Promise<Company> {
    await this.assertCompanyAccess(companyId);
    this.ctx.setActiveCompany(companyId); // only after authorization
    const company = await this.companies.findById(companyId);
    if (!company) throw new CompanyNotAssignedError(companyId);
    return company;
  }
}
