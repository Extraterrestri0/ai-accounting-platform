import type { ApplicationService } from '../../../shared-kernel';
import type { ScopedClient } from '../../../platform';
import type { AuditEventInput } from '../domain/models';

/**
 * PUBLIC audit service. `append` takes a ScopedClient so the caller can write the
 * audit event in the SAME transaction as the action it records (atomicity). The
 * hash chain is computed by the database (tamper-evident, append-only).
 */
export interface IAuditService extends ApplicationService {
  append(db: ScopedClient, event: AuditEventInput): Promise<void>;
  /** Recompute + validate the hash chain for the current tenant. */
  verifyChain(): Promise<boolean>;
}
export const AUDIT_SERVICE = Symbol('Audit.Service');
