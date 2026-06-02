import { Controller, Get, Inject } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';

@Controller('reference')
export class ReferenceController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Get('countries') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  countries() { return this.md.listCountries(); }

  @Get('currencies') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  currencies() { return this.md.listCurrencies(); }
}
