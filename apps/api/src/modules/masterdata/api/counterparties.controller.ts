import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateCounterpartyDto } from './dto/masterdata.dto';
import type { CounterpartyKind } from '../domain/models';

@Controller('counterparties')
export class CounterpartiesController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Post() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  create(@Body() dto: CreateCounterpartyDto) { return this.md.createCounterparty(dto); }

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  list(@Query('kind') kind?: CounterpartyKind, @Query('search') search?: string,
       @Query('activeOnly') activeOnly?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.md.listCounterparties({ kind, search, activeOnly: activeOnly === 'true',
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
  }

  @Get(':id') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  get(@Param('id') id: string) { return this.md.getCounterparty(id); }
}
