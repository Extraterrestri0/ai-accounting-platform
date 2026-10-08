import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { MASTERDATA_SERVICE, type IMasterDataService } from '../application/masterdata.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from './dto/masterdata.dto';

/** Expense categories (company-scoped reference data driving purchase classification). */
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(@Inject(MASTERDATA_SERVICE) private readonly md: IMasterDataService) {}

  @Get() @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  list(@Query('activeOnly') activeOnly?: string) { return this.md.listExpenseCategories(activeOnly !== 'false'); }

  @Get(':id') @RequirePermission(PERMISSIONS.MASTERDATA_READ)
  get(@Param('id') id: string) { return this.md.getExpenseCategory(id); }

  @Post() @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  create(@Body() dto: CreateExpenseCategoryDto) { return this.md.createExpenseCategory(dto); }

  @Put(':id') @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateExpenseCategoryDto) { return this.md.updateExpenseCategory(id, dto); }
}
