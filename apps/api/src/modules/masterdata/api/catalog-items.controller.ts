import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/masterdata.dto';
import type { CatalogItemKind } from '../domain/models';

/** Product / service catalog endpoints (company-scoped master data). */
@Controller('catalog-items')
export class CatalogItemsController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Post() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  create(@Body() dto: CreateCatalogItemDto) { return this.md.createCatalogItem(dto); }

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  list(@Query('search') search?: string, @Query('activeOnly') activeOnly?: string,
       @Query('kind') kind?: CatalogItemKind, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.md.listCatalogItems({ search, activeOnly: activeOnly === 'true', kind,
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
  }

  @Get(':id') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  get(@Param('id') id: string) { return this.md.getCatalogItem(id); }

  @Put(':id') @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) { return this.md.updateCatalogItem(id, dto); }
}
