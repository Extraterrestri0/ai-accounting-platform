import { Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService, type ScopedClient } from '../../../platform';
import { AuditRepository } from '../infrastructure/audit.repository';
import type { AuditEventInput } from '../domain/models';
import type { IAuditService } from './audit.service.interface';

@Injectable()
export class AuditService implements IAuditService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly db: DatabaseContextService,
    private readonly repo: AuditRepository,
  ) {}

  /** Append within the CALLER's transaction (same-txn atomicity). */
  append(db: ScopedClient, event: AuditEventInput): Promise<void> {
    const { tenantId } = this.ctx.currentOrThrow();
    return this.repo.append(db, tenantId, event);
  }

  verifyChain(): Promise<boolean> {
    const { tenantId } = this.ctx.currentOrThrow();
    return this.db.run((db) => this.repo.verifyChain(db, tenantId));
  }
}
