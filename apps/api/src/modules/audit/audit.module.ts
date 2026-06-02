import { Module } from '@nestjs/common';
import { AuditController } from './api/audit.controller';
import { AUDIT_SERVICE } from './application/audit.service.interface';
import { AuditService } from './application/audit.service';
import { AuditRepository } from './infrastructure/audit.repository';

@Module({
  controllers: [AuditController],
  providers: [{ provide: AUDIT_SERVICE, useClass: AuditService }, AuditRepository],
  exports: [AUDIT_SERVICE],
})
export class AuditModule {}
