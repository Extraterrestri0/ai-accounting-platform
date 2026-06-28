import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { registry, refreshQueueGauges } from '../../../platform/observability';
import { SaftQueueMonitor } from '../application/saft-queue.monitor';

/**
 * Prometheus scrape endpoint. Unauthenticated ops endpoint (no tenant data is exposed —
 * only process + aggregate queue counters); restrict at the network layer in production.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly queue: SaftQueueMonitor) {}

  @Get()
  @SkipThrottle()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    // Refresh queue gauges from Redis/BullMQ at scrape time (no-op zeros when unavailable).
    try { refreshQueueGauges(await this.queue.stats()); } catch { refreshQueueGauges(null); }
    return registry.metrics();
  }
}
