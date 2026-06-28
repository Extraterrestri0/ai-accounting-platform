import { BadRequestException, Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { PERIOD_SERVICE, type IAccountingPeriodService } from '../application/period.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { PeriodActionDto } from './dto/period.dto';

/** Accounting-period endpoints. Reads are PERIOD_READ; lock/open are PERIOD_MANAGE. */
@Controller('periods')
export class PeriodController {
  constructor(@Inject(PERIOD_SERVICE) private readonly periods: IAccountingPeriodService) {}

  @Get() @RequirePermission(PERMISSIONS.PERIOD_READ)
  list(@Query('months') months?: string) {
    return this.periods.listPeriods(months ? Number(months) : 12);
  }

  @Get('current') @RequirePermission(PERMISSIONS.PERIOD_READ)
  current() {
    return this.periods.getCurrentPeriod();
  }

  @Post('lock') @RequirePermission(PERMISSIONS.PERIOD_MANAGE)
  lock(@Body() dto: PeriodActionDto) {
    const { year, month } = this.validate(dto);
    return this.periods.lockPeriod(year, month);
  }

  @Post('open') @RequirePermission(PERMISSIONS.PERIOD_MANAGE)
  open(@Body() dto: PeriodActionDto) {
    const { year, month } = this.validate(dto);
    return this.periods.openPeriod(year, month);
  }

  private validate(dto: PeriodActionDto): { year: number; month: number } {
    const year = Number(dto?.year), month = Number(dto?.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('A valid year and month (1–12) are required.');
    }
    return { year, month };
  }
}
