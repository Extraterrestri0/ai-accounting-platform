import type { DomainEvent } from './domain-event';

/** Port for in-process publish/subscribe. Implemented (outbox-backed) in the platform task. */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: ReadonlyArray<DomainEvent>): Promise<void>;
}
export const EVENT_BUS = Symbol('EventBus');
