export type ActorType = 'user' | 'ai' | 'system';

/** Input to append an audit event. seq/prev_hash/this_hash are assigned by the DB. */
export interface AuditEventInput {
  companyId?: string;
  actorType: ActorType;
  actorId?: string;
  action: string;        // e.g. 'ledger.entry_posted'
  entityType: string;    // e.g. 'journal_entry'
  entityId?: string;
  reason?: string;
  before?: unknown;      // serialized to jsonb
  after?: unknown;
}

/** A read-model audit row (with the actor's email resolved for display). */
export interface AuditEventRecord {
  id: string;
  seq: number;
  companyId?: string;
  actorType: ActorType;
  actorId?: string;
  actorEmail?: string;
  action: string;
  category: string;       // action prefix, e.g. 'invoicing'
  entityType: string;
  entityId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  occurredAt: string;
}

/** Read filters for the audit trail (all optional; AND-combined). */
export interface AuditFilter {
  actorType?: ActorType;
  actorId?: string;
  action?: string;        // exact action OR a category prefix (e.g. 'invoicing' matches invoicing.*)
  entityType?: string;
  entityId?: string;
  from?: string;          // ISO date/datetime — inclusive lower bound on occurred_at
  to?: string;            // ISO date/datetime — inclusive upper bound
  search?: string;        // ILIKE over action / entity_type / reason
}

export interface AuditPage {
  items: AuditEventRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditSummary {
  total: number;
  distinctActors: number;
  byActorType: { actorType: string; count: number }[];
  byCategory: { category: string; count: number }[];
  firstAt?: string;
  lastAt?: string;
}

export type AuditChainStatus = 'verified' | 'warning' | 'failed';
export interface AuditVerification {
  status: AuditChainStatus;
  ok: boolean;
  events: number;        // chain length for the tenant
  checkedAt: string;
}
