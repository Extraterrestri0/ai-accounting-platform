import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VIES_SERVICE, type IViesService } from '../application/vies.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { toViesCsv } from '../domain/csv';
import type { ValidateVatDto } from './dto/vies.dto';

/**
 * VIES endpoints. Validation/refresh write a check row (MASTERDATA_WRITE); status is
 * MASTERDATA_READ; the declaration dataset is VAT_READ. All company-scoped (RLS).
 */
@Controller('vies')
export class ViesController {
  constructor(@Inject(VIES_SERVICE) private readonly vies: IViesService) {}

  @Post('validate') @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  validate(@Body() dto: ValidateVatDto) {
    if (!dto?.vatNumber) throw new BadRequestException('vatNumber is required.');
    return this.vies.validateVatNumber({ vatNumber: dto.vatNumber, counterpartyId: dto.counterpartyId, force: dto.force });
  }

  @Get('status/:counterpartyId') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  status(@Param('counterpartyId') counterpartyId: string) {
    return this.vies.getStatus(counterpartyId);
  }

  @Post('refresh/:counterpartyId') @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  refresh(@Param('counterpartyId') counterpartyId: string) {
    return this.vies.refreshValidation(counterpartyId);
  }

  @Get('dataset/:year/:month') @RequirePermission(PERMISSIONS.VAT_READ)
  async dataset(
    @Param('year') year: string,
    @Param('month') month: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const y = Number(year), m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new BadRequestException('A valid year and month (1–12) are required.');
    const ds = await this.vies.buildViesDataset(y, m);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="vies-${y}-${String(m).padStart(2, '0')}.csv"`);
      return `﻿${toViesCsv(ds.rows)}`; // UTF-8 BOM for Excel/Cyrillic
    }
    return ds;
  }
}
