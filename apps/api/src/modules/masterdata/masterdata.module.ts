import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { CounterpartiesController } from './api/counterparties.controller';
import { AccountsController } from './api/accounts.controller';
import { VatCodesController } from './api/vat-codes.controller';
import { CompanySettingsController } from './api/company-settings.controller';
import { ReferenceController } from './api/reference.controller';
import { MASTERDATA_SERVICE } from './application/masterdata.service.interface';
import { MasterDataService } from './application/masterdata.service';
import {
  CounterpartyRepository, AccountRepository, VatCodeRepository,
  ReferenceRepository, CompanySettingsRepository,
} from './infrastructure';

/**
 * Master Data context: counterparties, chart of accounts, VAT codes, company settings,
 * and global reference (countries/currencies). Writes are validated (EIK/VAT/country),
 * deduplicated, and audited in the same transaction. RBAC via the global guard +
 * @RequirePermission. Exposes ONLY MASTERDATA_SERVICE.
 */
@Module({
  imports: [AuditModule],
  controllers: [
    CounterpartiesController, AccountsController, VatCodesController,
    CompanySettingsController, ReferenceController,
  ],
  providers: [
    { provide: MASTERDATA_SERVICE, useClass: MasterDataService },
    CounterpartyRepository, AccountRepository, VatCodeRepository,
    ReferenceRepository, CompanySettingsRepository,
  ],
  exports: [MASTERDATA_SERVICE],
})
export class MasterDataModule {}
