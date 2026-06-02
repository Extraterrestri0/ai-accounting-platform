import { Module } from '@nestjs/common';
import { TenancyController } from './api/tenancy.controller';
import { TENANCY_SERVICE } from './application/tenancy.service.interface';
import { TenancyService } from './application/tenancy.service';
import { CompanyRepository } from './infrastructure/company.repository';
import { CompanyAssignmentRepository } from './infrastructure/company-assignment.repository';

/**
 * Tenancy bounded context. Exposes ONLY TENANCY_SERVICE + events.
 * Repositories are private; all DB access flows through DatabaseContextService
 * (transaction + SET LOCAL + RLS). Tenant scope is never accepted from clients.
 */
@Module({
  controllers: [TenancyController],
  providers: [
    { provide: TENANCY_SERVICE, useClass: TenancyService },
    CompanyRepository,
    CompanyAssignmentRepository,
  ],
  exports: [TENANCY_SERVICE],
})
export class TenancyModule {}
