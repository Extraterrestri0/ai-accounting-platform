import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateVatCodeDto } from './dto/masterdata.dto';

@Controller('vat-codes')
export class VatCodesController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Post() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  create(@Body() dto: CreateVatCodeDto) { return this.md.createVatCode(dto); }

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  list(@Query('activeOnly') activeOnly?: string) { return this.md.listVatCodes(activeOnly !== 'false'); }
}
