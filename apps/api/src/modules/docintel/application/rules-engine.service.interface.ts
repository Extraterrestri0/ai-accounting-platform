import type { ApplicationService } from '../../../shared-kernel';
import type { AccountingSuggestion, RuleType } from '../domain/rules/models';

export interface CreateRuleInput { ruleType: RuleType; name: string; matchKey?: string; accountCode?: string; vatCode?: string; confidence?: number; }

/** PUBLIC rules-engine service — consumed by the Review Queue (Task 010). Suggestions only. */
export interface IRulesEngineService extends ApplicationService {
  /** Generate (or regenerate) the accounting + VAT suggestion for a document's current extraction. */
  generateSuggestions(documentId: string): Promise<AccountingSuggestion>;
  getSuggestion(documentId: string): Promise<AccountingSuggestion | null>;
  createRule(input: CreateRuleInput): Promise<{ ruleId: string }>;
}
export const RULES_ENGINE_SERVICE = Symbol('DocIntel.RulesEngineService');
