import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { RULES_ENGINE_SERVICE, type IRulesEngineService } from '../application/rules-engine.service.interface';
import { RequirePermission, PERMISSIONS } from '../../identity';
import type { CreateRuleDto, SetCategoryDto } from './dto/suggestions.dto';

/** Rules engine: generate/read suggestions + manage rules. Guarded by the global RBAC guard. */
@Controller()
export class SuggestionsController {
  constructor(@Inject(RULES_ENGINE_SERVICE) private readonly engine: IRulesEngineService) {}

  @Post('documents/:id/suggest') @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  generate(@Param('id') id: string) { return this.engine.generateSuggestions(id); }

  @Get('documents/:id/suggestion') @RequirePermission(PERMISSIONS.COMPANY_READ)
  get(@Param('id') id: string) { return this.engine.getSuggestion(id); }

  @Patch('accounting-suggestions/:id/category') @RequirePermission(PERMISSIONS.REVIEW_APPROVE)
  setCategory(@Param('id') id: string, @Body() dto: SetCategoryDto) { return this.engine.setSuggestionCategory(id, dto.expenseCategoryId); }

  @Post('rules') @RequirePermission(PERMISSIONS.MASTERDATA_WRITE)
  createRule(@Body() dto: CreateRuleDto) { return this.engine.createRule(dto); }
}
