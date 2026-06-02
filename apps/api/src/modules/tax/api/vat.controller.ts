import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { VAT_SERVICE, type IVatService } from '../application/vat.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';

/** VAT registers + return dataset. Read/generate require VAT_READ (guarded globally). */
@Controller('vat/:year/:month')
export class VatController {
  constructor(@Inject(VAT_SERVICE) private readonly vat: IVatService) {}
  private p(year: string, month: string): [number, number] { return [Number(year), Number(month)]; }

  @Post('build') @RequirePermission(PERMISSIONS.VAT_READ)
  build(@Param('year') y: string, @Param('month') m: string) { const [yr, mo] = this.p(y, m); return this.vat.buildRegisters(yr, mo); }

  @Get('purchase-register') @RequirePermission(PERMISSIONS.VAT_READ)
  purchase(@Param('year') y: string, @Param('month') m: string) { const [yr, mo] = this.p(y, m); return this.vat.getPurchaseRegister(yr, mo); }

  @Get('sales-register') @RequirePermission(PERMISSIONS.VAT_READ)
  sales(@Param('year') y: string, @Param('month') m: string) { const [yr, mo] = this.p(y, m); return this.vat.getSalesRegister(yr, mo); }

  @Get('summary') @RequirePermission(PERMISSIONS.VAT_READ)
  summary(@Param('year') y: string, @Param('month') m: string) { const [yr, mo] = this.p(y, m); return this.vat.getSummary(yr, mo); }

  @Post('return') @RequirePermission(PERMISSIONS.VAT_READ)
  generateReturn(@Param('year') y: string, @Param('month') m: string) { const [yr, mo] = this.p(y, m); return this.vat.generateReturn(yr, mo); }

  @Get('validate') @RequirePermission(PERMISSIONS.VAT_READ)
  validate(@Param('year') y: string, @Param('month') m: string) { const [yr, mo] = this.p(y, m); return this.vat.validatePeriod(yr, mo); }
}
