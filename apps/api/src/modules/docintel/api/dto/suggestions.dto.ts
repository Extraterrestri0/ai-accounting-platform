import type { RuleType } from '../../domain/rules/models';
export interface CreateRuleDto { ruleType: RuleType; name: string; matchKey?: string; accountCode?: string; vatCode?: string; confidence?: number; }
