import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateAccountDto } from './dto/masterdata.dto';

@Controller('accounts')
export class AccountsController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Post() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  create(@Body() dto: CreateAccountDto) { return this.md.createAccount(dto); }

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  tree() { return this.md.getChartOfAccounts(); }

  @Get('search') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  search(@Query('q') q: string, @Query('activeOnly') activeOnly?: string) {
    return this.md.searchAccounts(q ?? '', activeOnly !== 'false');
  }
}
