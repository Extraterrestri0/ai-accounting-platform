import { Module } from '@nestjs/common';
import { COMPANY_ACCESS_PORT } from '../../platform';
import { TenancyController } from './api/tenancy.controller';
import { TENANCY_SERVICE } from './application/tenancy.service.interface';
import { TenancyService } from './application/tenancy.service';
import { CompanyRepository } from './infrastructure/company.repository';
import { CompanyAssignmentRepository } from './infrastructure/company-assignment.repository';
import { CompanyAccessAdapter } from './infrastructure/company-access.adapter';

/**
 * Tenancy bounded context. Exposes TENANCY_SERVICE + events, and provides the
 * platform COMPANY_ACCESS_PORT (per-request active-company authorization).
 * Repositories are private; all DB access flows through DatabaseContextService
 * (transaction + SET LOCAL + RLS). Tenant scope is never accepted from clients.
 */
@Module({
  controllers: [TenancyController],
  providers: [
    { provide: TENANCY_SERVICE, useClass: TenancyService },
    { provide: COMPANY_ACCESS_PORT, useClass: CompanyAccessAdapter },
    CompanyRepository,
    CompanyAssignmentRepository,
  ],
  exports: [TENANCY_SERVICE, COMPANY_ACCESS_PORT],
})
export class TenancyModule {}
