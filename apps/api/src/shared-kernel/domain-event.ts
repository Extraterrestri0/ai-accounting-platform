/**
 * Base contract for every domain event published across module boundaries.
 * Type-only. Carries tenant context so async consumers re-scope correctly.
 * (Payload shapes per event are finalized in the owning context's feature task.)
 */
export interface DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly type: string;
  readonly occurredAt: string; // ISO-8601 UTC
  readonly tenantId: string;
  readonly companyId?: string;
  readonly payload: TPayload;
}
