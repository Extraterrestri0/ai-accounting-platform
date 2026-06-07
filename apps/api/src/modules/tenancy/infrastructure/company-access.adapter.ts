import { Injectable } from '@nestjs/common';
import { TenantContextService, type CompanyAccessPort } from '../../../platform';
import { CompanyAssignmentRepository } from './company-assignment.repository';

/**
 * Tenancy's implementation of the platform CompanyAccessPort.
 * Authorizes the current user (from request context) for a company by checking
 * an ACTIVE company_assignment under RLS. Used by the tenant-context middleware
 * to establish the active company per request from the X-Company-Id header.
 */
@Injectable()
export class CompanyAccessAdapter implements CompanyAccessPort {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly assignments: CompanyAssignmentRepository,
  ) {}

  isAccessible(companyId: string): Promise<boolean> {
    const { userId } = this.ctx.currentOrThrow(); // tenant/user already bound by the middleware
    return this.assignments.hasActiveAssignment(userId, companyId);
  }
}
