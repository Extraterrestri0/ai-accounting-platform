import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContextService } from '../../../platform';
import { MASTERDATA_SERVICE, type IMasterDataService, type ExpenseCategory } from '../../masterdata';
import { SuggestionRepository } from '../infrastructure/suggestion.repository';
import { classifyByKeywords } from '../domain/classification/keyword-classifier';
import type { ClassificationResult, VatTreatment } from '../domain/rules/models';

export interface ClassifyInput { counterpartyId?: string; supplierName?: string; supplierEik?: string; description?: string; }

/**
 * Expense classification engine (Task 1.2). Deterministic-first (Invariant 6):
 *   1. Supplier memory (most-used category for this counterparty)
 *   2/3. Deterministic brand + keyword rules
 *   4. AI fallback — only if configured (off by default; hook below)
 *   5. Default category: Other
 */
@Injectable()
export class ExpenseClassificationService {
  constructor(
    private readonly db: DatabaseContextService,
    private readonly suggestions: SuggestionRepository,
    @Inject(MASTERDATA_SERVICE) private readonly masterdata: IMasterDataService,
  ) {}

  async classify(input: ClassifyInput): Promise<ClassificationResult> {
    const categories = await this.masterdata.listExpenseCategories(true);
    const byCode = new Map(categories.map((c) => [c.code, c]));
    const toResult = (cat: ExpenseCategory, confidence: number, reason: string, source: ClassificationResult['source']): ClassificationResult => ({
      categoryId: cat.id, categoryCode: cat.code, nameBg: cat.nameBg, nameEn: cat.nameEn,
      defaultAccountId: cat.defaultAccountId, defaultAccountCode: cat.defaultAccountCode,
      defaultVatTreatment: cat.defaultVatTreatment as VatTreatment, saftCode: cat.saftCode,
      confidence, reason, source,
    });

    // 1) Supplier memory.
    if (input.counterpartyId) {
      const mem = await this.db.run((db) => this.suggestions.categoryMemory(db, input.counterpartyId!));
      const cat = mem ? byCode.get(mem.categoryCode) : undefined;
      if (mem && cat) return toResult(cat, Math.min(0.97, 0.8 + Math.min(mem.count, 15) / 100), `Запомнено от ${mem.count} предходни фактури от този доставчик.`, 'memory');
    }

    // 2/3) Deterministic brand + keyword rules.
    const text = [input.supplierName, input.description].filter(Boolean).join(' ');
    const hit = classifyByKeywords(text);
    const hitCat = hit ? byCode.get(hit.code) : undefined;
    if (hit && hitCat) return toResult(hitCat, hit.confidence, hit.reason, 'rule');

    // 4) AI fallback — intentionally not invoked unless an EU AI classifier is configured
    //    (deterministic-first). Left as an extension point.

    // 5) Default: Other.
    const other = byCode.get('OTHER');
    if (other) return toResult(other, 0.3, 'Няма съвпадение по правило или памет; по подразбиране „Други“.', 'rule');
    return { categoryId: null, categoryCode: 'OTHER', confidence: 0.3, reason: 'Няма конфигурирани категории.', source: 'rule' };
  }
}
