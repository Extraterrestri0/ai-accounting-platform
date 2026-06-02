import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { UpdateCompanySettingsDto } from './dto/masterdata.dto';

@Controller('company-settings')
export class CompanySettingsController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  get() { return this.md.getCompanySettings(); }

  @Put() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  update(@Body() dto: UpdateCompanySettingsDto) { return this.md.updateCompanySettings(dto); }
}
