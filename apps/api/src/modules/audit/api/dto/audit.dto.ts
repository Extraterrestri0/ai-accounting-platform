import type { ActorType } from '../../domain/models';

/** Query-string filters for the audit list/timeline endpoints (all optional). */
export interface AuditQueryDto {
  actorType?: ActorType;
  actorId?: string;
  action?: string;      // exact action or category prefix (e.g. 'invoicing')
  entityType?: string;
  entityId?: string;
  from?: string;        // ISO date/datetime
  to?: string;          // ISO date/datetime
  search?: string;
  page?: string;
  pageSize?: string;
  limit?: string;
}
