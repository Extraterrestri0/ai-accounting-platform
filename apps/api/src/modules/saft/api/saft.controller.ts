import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SAFT_EXPORT_SERVICE, type ISaftExportService } from '../application/saft-export.service.interface';
import { SAFT_VALIDATION_SERVICE, type ISaftValidationService } from '../application/saft-validation.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { FeatureFlags } from '../../../config/feature-flags';
import type { GenerateExportDto } from './dto/saft.dto';

/** SAF-T endpoints. Reads SAFT_READ; generation SAFT_GENERATE. Company-scoped (RLS). */
@Controller('saft')
export class SaftController {
  constructor(
    @Inject(SAFT_EXPORT_SERVICE) private readonly exports: ISaftExportService,
    @Inject(SAFT_VALIDATION_SERVICE) private readonly validation: ISaftValidationService,
    private readonly flags: FeatureFlags,
  ) {}

  private ym(year: number | string, month: number | string): { year: number; month: number } {
    const y = Number(year), m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new BadRequestException('A valid year and month (1–12) are required.');
    return { year: y, month: m };
  }

  /**
   * Generate a SAF-T export. With SAFT_XML_ENABLED on, this enqueues a background job
   * and returns 202 Accepted + the queued record; off, it preserves v1 synchronous
   * behavior (build now, return the generated record, default 201).
   */
  @Post('exports') @RequirePermission(PERMISSIONS.SAFT_GENERATE)
  async generate(@Body() dto: GenerateExportDto, @Res({ passthrough: true }) res: Response) {
    const { year, month } = this.ym(dto?.year, dto?.month);
    if (this.flags.saftXmlEnabled()) {
      const rec = await this.exports.requestExport(year, month);
      res.status(202);
      return rec;
    }
    return this.exports.generateExport(year, month);
  }

  @Get('exports') @RequirePermission(PERMISSIONS.SAFT_READ)
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.exports.listExports(page ? Number(page) : 1, pageSize ? Number(pageSize) : 50);
  }

  @Get('exports/:id') @RequirePermission(PERMISSIONS.SAFT_READ)
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const rec = await this.exports.getExport(id);
    if (!rec) throw new NotFoundException('SAF-T export not found.');
    return rec;
  }

  @Get('exports/:id/dataset') @RequirePermission(PERMISSIONS.SAFT_READ)
  async dataset(@Param('id', ParseUUIDPipe) id: string) {
    const ds = await this.exports.getExportDataset(id);
    if (!ds) throw new NotFoundException('SAF-T export dataset not found.');
    return ds;
  }

  /** Issue a short-lived signed URL for the export's generated XML (audited). */
  @Get('exports/:id/download') @RequirePermission(PERMISSIONS.SAFT_READ)
  async download(@Param('id', ParseUUIDPipe) id: string) {
    const dl = await this.exports.getDownloadUrl(id);
    if (!dl) throw new NotFoundException('No SAF-T XML artifact for this export.');
    return dl;
  }

  @Get('validate/:year/:month') @RequirePermission(PERMISSIONS.SAFT_READ)
  validate(@Param('year') year: string, @Param('month') month: string) {
    const ym = this.ym(year, month);
    return this.validation.validatePeriod(ym.year, ym.month);
  }
}
