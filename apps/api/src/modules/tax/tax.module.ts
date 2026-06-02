import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { TaxController } from './api/tax.controller';
import { VatController } from './api/vat.controller';
import { TAX_SERVICE } from './application/tax.service.interface';
import { TaxService } from './application/tax.service';
import { VAT_SERVICE } from './application/vat.service.interface';
import { VatService } from './application/vat.service';
import { VatRepository } from './infrastructure/vat.repository';

/**
 * Tax bounded context. Public surface: TAX_SERVICE + VAT_SERVICE.
 * The VAT module READS the immutable ledger (journal_entries/lines) + VAT codes
 * and writes only its own vat_* tables — it never writes the ledger.
 */
@Module({
  imports: [AuditModule],
  controllers: [TaxController, VatController],
  providers: [
    { provide: TAX_SERVICE, useClass: TaxService },
    { provide: VAT_SERVICE, useClass: VatService },
    VatRepository,
  ],
  exports: [TAX_SERVICE, VAT_SERVICE],
})
export class TaxModule {}
