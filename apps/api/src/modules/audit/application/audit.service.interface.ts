import type { ApplicationService } from '../../../shared-kernel';
import type { ScopedClient } from '../../../platform';
import type {
  AuditEventInput, AuditEventRecord, AuditFilter, AuditPage, AuditSummary, AuditVerification,
} from '../domain/models';

/**
 * PUBLIC audit service. `append` takes a ScopedClient so the caller can write the
 * audit event in the SAME transaction as the action it records (atomicity). The
 * hash chain is computed by the database (tamper-evident, append-only).
 *
 * The read methods expose the trail to users — always scoped to the ACTIVE company
 * (tenant isolation enforced by RLS). They never return the hash-chain columns.
 */
export interface IAuditService extends ApplicationService {
  append(db: ScopedClient, event: AuditEventInput): Promise<void>;

  /** Filtered + paginated read of the active company's trail (most-recent first). */
  query(filter: AuditFilter, page?: number, pageSize?: number): Promise<AuditPage>;
  /** Recent events for the active company (dashboard / timeline). */
  timeline(limit?: number, filter?: AuditFilter): Promise<AuditEventRecord[]>;
  /** Complete chronological history for one entity. */
  entityHistory(entityType: string, entityId: string): Promise<AuditEventRecord[]>;
  /** Aggregate counts for the active company in an optional date range. */
  summary(from?: string, to?: string): Promise<AuditSummary>;

  /** Recompute + validate the hash chain for the current tenant. */
  verifyChain(): Promise<boolean>;
  /** Verification with a status tier + chain length, for the integrity panel. */
  verify(): Promise<AuditVerification>;
}
export const AUDIT_SERVICE = Symbol('Audit.Service');
