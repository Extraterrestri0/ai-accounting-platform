import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseContextService, TenantContextService, type ScopedClient } from '../../../platform';
import { AuditRepository } from '../infrastructure/audit.repository';
import { clampPage } from '../domain/audit-query';
import type {
  AuditEventInput, AuditEventRecord, AuditFilter, AuditPage, AuditSummary, AuditVerification,
} from '../domain/models';
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

  /** Reads require an ACTIVE company — the trail is scoped to it (tenant isolation is RLS). */
  private requireCompany(): string {
    const c = this.ctx.currentOrThrow();
    if (!c.companyId) throw new ForbiddenException('No active company selected for audit access.');
    return c.companyId;
  }

  async query(filter: AuditFilter, page?: number, pageSize?: number): Promise<AuditPage> {
    const companyId = this.requireCompany();
    const { page: p, pageSize: size, limit, offset } = clampPage(page, pageSize);
    const { items, total } = await this.db.run((db) => this.repo.list(db, companyId, filter ?? {}, limit, offset));
    return { items, total, page: p, pageSize: size };
  }

  timeline(limit = 10, filter: AuditFilter = {}): Promise<AuditEventRecord[]> {
    const companyId = this.requireCompany();
    const n = Math.min(100, Math.max(1, Math.floor(limit)));
    return this.db.run((db) => this.repo.list(db, companyId, filter, n, 0)).then((r) => r.items);
  }

  entityHistory(entityType: string, entityId: string): Promise<AuditEventRecord[]> {
    const companyId = this.requireCompany();
    return this.db.run((db) => this.repo.byEntity(db, companyId, entityType, entityId));
  }

  summary(from?: string, to?: string): Promise<AuditSummary> {
    const companyId = this.requireCompany();
    return this.db.run((db) => this.repo.summary(db, companyId, from, to));
  }

  verifyChain(): Promise<boolean> {
    const { tenantId } = this.ctx.currentOrThrow();
    return this.db.run((db) => this.repo.verifyChain(db, tenantId));
  }

  async verify(): Promise<AuditVerification> {
    const { tenantId } = this.ctx.currentOrThrow();
    this.requireCompany(); // gate on an active company like the other reads
    const { ok, events } = await this.db.run(async (db) => ({
      ok: await this.repo.verifyChain(db, tenantId),
      events: await this.repo.chainLength(db, tenantId),
    }));
    // 'warning' when the chain is valid but empty (nothing to attest yet).
    const status = ok ? (events === 0 ? 'warning' : 'verified') : 'failed';
    return { status, ok, events, checkedAt: new Date().toISOString() };
  }
}
