import type { EventBus } from '../shared-kernel';

/** Placeholder. The transactional-outbox-backed EventBus is implemented in the platform task. */
export class NotImplementedEventBus implements EventBus {
  async publish(): Promise<void> {
    throw new Error('EventBus not implemented yet (see platform/outbox task).');
  }
  async publishAll(): Promise<void> {
    throw new Error('EventBus not implemented yet (see platform/outbox task).');
  }
}
