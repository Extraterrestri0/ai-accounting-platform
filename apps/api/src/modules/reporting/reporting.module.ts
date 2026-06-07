import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { TaxModule } from '../tax';
import { PaymentsModule } from '../payments';
import { MasterDataModule } from '../masterdata';
import { ReportingController } from './api/reporting.controller';
import { ReportsController } from './api/reports.controller';
import { REPORTING_SERVICE } from './application/reporting.service.interface';
import { ReportingService } from './application/reporting.service';
import { REPORTS_SERVICE } from './application/reports.service.interface';
import { ReportsService } from './application/reports.service';
import { ReportsRepository } from './infrastructure/reports.repository';

/**
 * Reporting bounded context. Public surface: REPORTS_SERVICE (+ legacy REPORTING_SERVICE).
 * Reports READ the immutable ledger / invoices / VAT registers and write only report_runs /
 * report_snapshots — never the ledger. VAT report delegates to the tax context.
 */
@Module({
  imports: [AuditModule, TaxModule, PaymentsModule, MasterDataModule],
  controllers: [ReportingController, ReportsController],
  providers: [
    { provide: REPORTING_SERVICE, useClass: ReportingService },
    { provide: REPORTS_SERVICE, useClass: ReportsService },
    ReportsRepository,
  ],
  exports: [REPORTING_SERVICE, REPORTS_SERVICE],
})
export class ReportingModule {}
