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
