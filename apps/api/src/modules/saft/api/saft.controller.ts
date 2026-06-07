import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { SAFT_EXPORT_SERVICE, type ISaftExportService } from '../application/saft-export.service.interface';
import { SAFT_VALIDATION_SERVICE, type ISaftValidationService } from '../application/saft-validation.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { GenerateExportDto } from './dto/saft.dto';

/** SAF-T v1 endpoints. Reads SAFT_READ; generation SAFT_GENERATE. Company-scoped (RLS). */
@Controller('saft')
export class SaftController {
  constructor(
    @Inject(SAFT_EXPORT_SERVICE) private readonly exports: ISaftExportService,
    @Inject(SAFT_VALIDATION_SERVICE) private readonly validation: ISaftValidationService,
  ) {}

  private ym(year: number | string, month: number | string): { year: number; month: number } {
    const y = Number(year), m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new BadRequestException('A valid year and month (1–12) are required.');
    return { year: y, month: m };
  }

  @Post('exports') @RequirePermission(PERMISSIONS.SAFT_GENERATE)
  generate(@Body() dto: GenerateExportDto) {
    const { year, month } = this.ym(dto?.year, dto?.month);
    return this.exports.generateExport(year, month);
  }

  @Get('exports') @RequirePermission(PERMISSIONS.SAFT_READ)
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.exports.listExports(page ? Number(page) : 1, pageSize ? Number(pageSize) : 50);
  }

  @Get('exports/:id') @RequirePermission(PERMISSIONS.SAFT_READ)
  get(@Param('id') id: string) { return this.exports.getExport(id); }

  @Get('exports/:id/dataset') @RequirePermission(PERMISSIONS.SAFT_READ)
  dataset(@Param('id') id: string) { return this.exports.getExportDataset(id); }

  @Get('validate/:year/:month') @RequirePermission(PERMISSIONS.SAFT_READ)
  validate(@Param('year') year: string, @Param('month') month: string) {
    const ym = this.ym(year, month);
    return this.validation.validatePeriod(ym.year, ym.month);
  }
}
