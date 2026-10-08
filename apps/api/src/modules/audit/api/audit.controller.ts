import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { AUDIT_SERVICE, type IAuditService } from '../application/audit.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { ActorType, AuditFilter } from '../domain/models';
import type { AuditQueryDto } from './dto/audit.dto';

const ACTOR_TYPES: ActorType[] = ['user', 'ai', 'system'];

/**
 * Audit trail read endpoints. Every route is AUDIT_READ-gated and scoped to the
 * ACTIVE company by the service (tenant isolation enforced by RLS). Hash-chain
 * columns are never exposed; the chain can only be verified, not read.
 */
@Controller('audit')
export class AuditController {
  constructor(@Inject(AUDIT_SERVICE) private readonly audit: IAuditService) {}

  private filter(q: AuditQueryDto): AuditFilter {
    return {
      actorType: q.actorType && ACTOR_TYPES.includes(q.actorType) ? q.actorType : undefined,
      actorId: q.actorId || undefined,
      action: q.action || undefined,
      entityType: q.entityType || undefined,
      entityId: q.entityId || undefined,
      from: q.from || undefined,
      to: q.to || undefined,
      search: q.search || undefined,
    };
  }

  @Get() @RequirePermission(PERMISSIONS.AUDIT_READ)
  list(@Query() q: AuditQueryDto) {
    return this.audit.query(this.filter(q), q.page ? Number(q.page) : 1, q.pageSize ? Number(q.pageSize) : 50);
  }

  @Get('timeline') @RequirePermission(PERMISSIONS.AUDIT_READ)
  timeline(@Query() q: AuditQueryDto) {
    return this.audit.timeline(q.limit ? Number(q.limit) : 10, this.filter(q));
  }

  @Get('summary') @RequirePermission(PERMISSIONS.AUDIT_READ)
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.audit.summary(from || undefined, to || undefined);
  }

  @Get('verify') @RequirePermission(PERMISSIONS.AUDIT_READ)
  verify() {
    return this.audit.verify();
  }

  @Get('entity/:type/:id') @RequirePermission(PERMISSIONS.AUDIT_READ)
  entity(@Param('type') type: string, @Param('id') id: string) {
    return this.audit.entityHistory(type, id);
  }
}
