import { Global, Module } from '@nestjs/common';
import { EVENT_BUS } from '../shared-kernel';
import { NotImplementedEventBus } from './event-bus.stub';

/**
 * Cross-cutting infrastructure made available to every context.
 * Bootstrap wiring only — concrete adapters (DB/RLS, outbox, storage, AI gateway)
 * are added in their dedicated tasks.
 */
@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: NotImplementedEventBus }],
  exports: [EVENT_BUS],
})
export class PlatformModule {}
