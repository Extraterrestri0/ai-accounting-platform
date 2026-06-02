import { Controller, Get } from '@nestjs/common';
import { HealthService } from '../application/health.service';

/** Unauthenticated health probes for orchestrators / load balancers / uptime monitors. */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get() health_() { return this.health.health(); }
  @Get('live') live() { return this.health.liveness(); }
  @Get('ready') ready() { return this.health.readiness(); }
}
